from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings, get_settings
from .image_preprocessing import (
    ImageLimitError,
    InvalidImageError,
    decode_and_preprocess,
)
from .ocr_engine import OCREngine, create_ocr_engine
from .rc_parser import merge_ocr_lines, parse_rc
from .schemas import HealthResponse, OCRLine, RCOCRResponse


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
logger = logging.getLogger("ocr_service")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "event": record.getMessage(),
        }
        for key in (
            "request_id",
            "method",
            "path",
            "status_code",
            "processing_ms",
            "paddle_version",
            "paddleocr_version",
            "paddlex_version",
            "device",
            "mkldnn_enabled",
            "extracted_fields",
            "field_confidence",
            "low_confidence_fields",
            "rejected_fields",
        ):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["error_type"] = record.exc_info[0].__name__
        return json.dumps(payload, separators=(",", ":"))


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger.handlers.clear()
    logger.addHandler(handler)
    logger.setLevel(level.upper())
    logger.propagate = False


def create_app(
    settings: Settings | None = None,
    engine_factory: Callable[[Settings], OCREngine] = create_ocr_engine,
) -> FastAPI:
    runtime_settings = settings or get_settings()
    configure_logging(runtime_settings.log_level)

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        logger.info("ocr_engine_initializing")
        application.state.ocr_engine = await asyncio.to_thread(
            engine_factory, runtime_settings
        )
        logger.info("ocr_engine_ready")
        yield

    application = FastAPI(
        title="Vimawallah OCR",
        version="0.1.0",
        lifespan=lifespan,
    )
    application.state.settings = runtime_settings

    if runtime_settings.allowed_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=runtime_settings.allowed_origins,
            allow_credentials=runtime_settings.cors_allow_credentials,
            allow_methods=["GET", "POST"],
            allow_headers=["Content-Type", "X-Request-ID"],
        )

    @application.middleware("http")
    async def request_logging(request: Request, call_next: Callable[..., Any]):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = round((time.perf_counter() - started) * 1000)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request_completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "processing_ms": elapsed_ms,
            },
        )
        return response

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Invalid request."},
        )

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "unhandled_request_error",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "method": request.method,
                "path": request.url.path,
            },
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error."},
        )

    @application.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        return HealthResponse(service=runtime_settings.service_name)

    @application.post("/v1/ocr/rc", response_model=RCOCRResponse)
    async def ocr_vehicle_rc(
        request: Request,
        front: UploadFile | None = File(default=None),
        back: UploadFile | None = File(default=None),
        combined: UploadFile | None = File(default=None),
    ) -> RCOCRResponse:
        started = time.perf_counter()
        uploads = [
            ("front", front),
            ("back", back),
            ("combined", combined),
        ]
        selected = [(source, upload) for source, upload in uploads if upload is not None]
        if not selected:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide at least one of front, back, or combined.",
            )

        try:
            payloads = await _read_uploads(selected, runtime_settings)
            engine: OCREngine = request.app.state.ocr_engine
            groups = await asyncio.wait_for(
                asyncio.to_thread(
                    _recognize_payloads, payloads, engine, runtime_settings
                ),
                timeout=runtime_settings.request_timeout_seconds,
            )
        except asyncio.TimeoutError as exc:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="OCR processing timed out.",
            ) from exc
        except ImageLimitError as exc:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=str(exc),
            ) from exc
        except InvalidImageError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        finally:
            for _, upload in selected:
                await upload.close()

        lines = merge_ocr_lines(*groups)
        parsed = parse_rc(lines, runtime_settings.min_field_confidence)
        logger.info(
            "rc_fields_parsed",
            extra={
                "extracted_fields": parsed.fields.model_dump(exclude_none=True),
                "field_confidence": parsed.field_confidence,
                "low_confidence_fields": sorted(
                    field
                    for field, confidence in parsed.field_confidence.items()
                    if confidence < 0.8
                ),
                "rejected_fields": parsed.rejected_fields,
            },
        )
        response_warnings = list(parsed.warnings)
        if not lines:
            response_warnings.append("OCR did not detect readable text.")

        overall_confidence = 0.0
        if lines:
            overall_confidence = min(
                0.9999, sum(line.confidence for line in lines) / len(lines)
            )

        return RCOCRResponse(
            fields=parsed.fields,
            field_confidence=parsed.field_confidence,
            raw_text="\n".join(line.text for line in lines),
            ocr_lines=lines,
            overall_confidence=round(overall_confidence, 4),
            warnings=list(dict.fromkeys(response_warnings)),
            processing_ms=round((time.perf_counter() - started) * 1000),
        )

    return application


async def _read_uploads(
    selected: list[tuple[str, UploadFile]], settings: Settings
) -> list[tuple[str, bytes]]:
    total_size = 0
    payloads: list[tuple[str, bytes]] = []

    for source, upload in selected:
        extension = Path(upload.filename or "").suffix.lower()
        if extension not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"{source} must be jpg, jpeg, png, or webp.",
            )

        chunks: list[bytes] = []
        file_size = 0
        while chunk := await upload.read(settings.upload_chunk_bytes):
            file_size += len(chunk)
            total_size += len(chunk)
            if total_size > settings.max_upload_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    detail=f"Total upload exceeds {settings.max_upload_bytes} bytes.",
                )
            chunks.append(chunk)

        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{source} is empty.",
            )
        payloads.append((source, b"".join(chunks)))

    return payloads


def _recognize_payloads(
    payloads: list[tuple[str, bytes]],
    engine: OCREngine,
    settings: Settings,
) -> list[list[OCRLine]]:
    groups: list[list[OCRLine]] = []
    for source, payload in payloads:
        image = decode_and_preprocess(payload, settings)
        groups.append(engine.recognize(image, source))
    return groups


app = create_app()
