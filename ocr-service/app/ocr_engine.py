from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
from pathlib import Path
from typing import Any, Protocol

import cv2
import numpy as np

from .config import Settings
from .schemas import OCRLine


logger = logging.getLogger("ocr_service")


class OCREngine(Protocol):
    def recognize(self, image: np.ndarray, source: str) -> list[OCRLine]: ...


class PaddleOCREngine:
    """Thread-safe wrapper around one process-wide PaddleOCR pipeline."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._pipeline: Any | None = None
        self._inference_lock = threading.Lock()

    def initialize(self) -> None:
        cache_dir = self.settings.model_cache_dir.resolve()
        cache_dir.mkdir(parents=True, exist_ok=True)
        os.environ["PADDLE_HOME"] = str(cache_dir / "paddle")
        os.environ["PADDLE_PDX_CACHE_HOME"] = str(cache_dir / "paddlex")
        # This must be set before importing Paddle. The constructor option below
        # is also required because PaddleX selects its own inference backend.
        os.environ["FLAGS_use_mkldnn"] = "0"

        # Lazy import keeps API/parser tests independent from large model packages.
        import paddle
        import paddleocr
        import paddlex
        from paddleocr import PaddleOCR

        logger.info(
            "ocr_runtime",
            extra={
                "paddle_version": paddle.__version__,
                "paddleocr_version": paddleocr.__version__,
                "paddlex_version": paddlex.__version__,
                "device": "cpu",
                "mkldnn_enabled": False,
            },
        )

        self._pipeline = PaddleOCR(
            device="cpu",
            text_detection_model_name=self.settings.text_detection_model_name,
            text_recognition_model_name=self.settings.text_recognition_model_name,
            use_doc_orientation_classify=self.settings.enable_document_orientation,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            enable_mkldnn=False,
            cpu_threads=self.settings.cpu_threads,
        )

    def recognize(self, image: np.ndarray, source: str) -> list[OCRLine]:
        if self._pipeline is None:
            raise RuntimeError("OCR engine has not been initialized")

        # Paddle accepts arrays, but a private temporary PNG gives consistent
        # behavior across compatible PaddleOCR releases. It is always deleted.
        with tempfile.TemporaryDirectory(prefix="vimawallah-ocr-") as temp_dir:
            image_path = Path(temp_dir) / "input.png"
            encoded, payload = cv2.imencode(".png", image)
            if not encoded:
                raise RuntimeError("failed to encode preprocessed image")
            image_path.write_bytes(payload.tobytes())

            with self._inference_lock:
                results = list(self._pipeline.predict(str(image_path)))

        lines: list[OCRLine] = []
        for result in results:
            lines.extend(_extract_lines(result, source))
        return lines


def create_ocr_engine(settings: Settings) -> PaddleOCREngine:
    engine = PaddleOCREngine(settings)
    engine.initialize()
    return engine


def _extract_lines(result: Any, source: str) -> list[OCRLine]:
    mapping = _result_mapping(result)
    raw_texts = mapping.get("rec_texts")
    raw_scores = mapping.get("rec_scores")
    raw_boxes = mapping.get("rec_polys")
    if raw_boxes is None:
        raw_boxes = mapping.get("rec_boxes")

    texts = list(raw_texts) if raw_texts is not None else []
    scores = list(raw_scores) if raw_scores is not None else []
    boxes = list(raw_boxes) if raw_boxes is not None else []

    lines: list[OCRLine] = []
    for index, text in enumerate(texts):
        normalized_text = str(text).strip()
        if not normalized_text:
            continue
        confidence = float(scores[index]) if index < len(scores) else 0.0
        bounding_box = _normalise_box(boxes[index]) if index < len(boxes) else None
        lines.append(
            OCRLine(
                text=normalized_text,
                confidence=max(0.0, min(1.0, confidence)),
                source=source,
                bounding_box=bounding_box,
            )
        )
    return lines


def _result_mapping(result: Any) -> dict[str, Any]:
    payload = getattr(result, "json", result)
    if callable(payload):
        payload = payload()
    if isinstance(payload, str):
        payload = json.loads(payload)
    if not isinstance(payload, dict):
        raise RuntimeError("PaddleOCR returned an unsupported result type")
    nested = payload.get("res")
    return nested if isinstance(nested, dict) else payload


def _normalise_box(box: Any) -> list[list[int]] | None:
    if hasattr(box, "tolist"):
        box = box.tolist()
    if not isinstance(box, list):
        return None
    if box and not isinstance(box[0], list) and len(box) == 4:
        left, top, right, bottom = (int(value) for value in box)
        return [[left, top], [right, top], [right, bottom], [left, bottom]]
    try:
        return [[int(point[0]), int(point[1])] for point in box]
    except (IndexError, TypeError, ValueError):
        return None
