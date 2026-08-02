#!/usr/bin/env python3
"""Run a real OCR request against a synthetic RC-like image."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
import uuid
from typing import Any

import cv2
import numpy as np


def synthetic_test_image() -> bytes:
    image = np.full((360, 1280, 3), 255, dtype=np.uint8)
    cv2.putText(
        image,
        "REGN NO GJ16DM9932",
        (45, 205),
        cv2.FONT_HERSHEY_SIMPLEX,
        2.6,
        (0, 0, 0),
        6,
        cv2.LINE_AA,
    )
    encoded, payload = cv2.imencode(".png", image)
    if not encoded:
        raise RuntimeError("failed to encode synthetic OCR smoke-test image")
    return payload.tobytes()


def multipart_payload(image: bytes) -> tuple[bytes, str]:
    boundary = f"vimawallah-ocr-smoke-{uuid.uuid4().hex}"
    body = b"".join(
        [
            f"--{boundary}\r\n".encode(),
            b'Content-Disposition: form-data; name="combined"; '
            b'filename="synthetic-rc.png"\r\n',
            b"Content-Type: image/png\r\n\r\n",
            image,
            f"\r\n--{boundary}--\r\n".encode(),
        ]
    )
    return body, f"multipart/form-data; boundary={boundary}"


def validate_response(status: int, content_type: str, body: bytes) -> dict[str, Any]:
    if status != 200:
        raise RuntimeError(f"OCR smoke test returned HTTP {status}: {body[:500]!r}")
    if "application/json" not in content_type.lower():
        raise RuntimeError(
            f"OCR smoke test did not return JSON (Content-Type: {content_type!r})"
        )

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError("OCR smoke test returned invalid JSON") from exc

    if not isinstance(payload, dict):
        raise RuntimeError("OCR smoke-test JSON must be an object")
    if payload.get("success") is not True:
        raise RuntimeError("OCR smoke-test JSON did not report success")
    if payload.get("document_type") != "vehicle_rc":
        raise RuntimeError("OCR smoke-test JSON has the wrong document type")
    if not isinstance(payload.get("ocr_lines"), list):
        raise RuntimeError("OCR smoke-test JSON is missing ocr_lines")
    return payload


def run(url: str, timeout: float) -> dict[str, Any]:
    body, content_type = multipart_payload(synthetic_test_image())
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": content_type, "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_body = response.read()
            payload = validate_response(
                response.status,
                response.headers.get("Content-Type", ""),
                response_body,
            )
    except urllib.error.HTTPError as exc:
        error_body = exc.read()
        raise RuntimeError(
            f"OCR smoke test returned HTTP {exc.code}: {error_body[:1000]!r}"
        ) from exc

    return {
        "smoke_test": "passed",
        "http_status": 200,
        "response_is_json": True,
        "detected_lines": len(payload["ocr_lines"]),
        "processing_ms": payload.get("processing_ms"),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:8001/v1/ocr/rc",
        help="Internal OCR inference endpoint",
    )
    parser.add_argument("--timeout", type=float, default=120.0)
    args = parser.parse_args()

    try:
        result = run(args.url, args.timeout)
    except Exception as exc:
        print(f"OCR inference smoke test failed: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(result, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
