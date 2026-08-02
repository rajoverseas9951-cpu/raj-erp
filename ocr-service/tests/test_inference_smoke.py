from __future__ import annotations

import json

import cv2
import numpy as np
import pytest

from scripts.inference_smoke_test import (
    multipart_payload,
    synthetic_test_image,
    validate_response,
)


def test_synthetic_image_and_multipart_payload_are_valid() -> None:
    image_bytes = synthetic_test_image()
    decoded = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    body, content_type = multipart_payload(image_bytes)

    assert decoded is not None
    assert decoded.shape == (360, 1280, 3)
    assert decoded.min() < 10
    assert content_type.startswith("multipart/form-data; boundary=")
    assert b'name="combined"' in body
    assert image_bytes in body


def test_validate_response_requires_successful_ocr_json() -> None:
    payload = validate_response(
        200,
        "application/json; charset=utf-8",
        json.dumps(
            {
                "success": True,
                "document_type": "vehicle_rc",
                "ocr_lines": [],
                "processing_ms": 123.4,
            }
        ).encode(),
    )

    assert payload["success"] is True


@pytest.mark.parametrize(
    ("status", "content_type", "body"),
    [
        (500, "application/json", b'{"detail":"Internal server error."}'),
        (200, "text/html", b"not json"),
        (200, "application/json", b'{"success":false}'),
    ],
)
def test_validate_response_rejects_non_inference_success(
    status: int, content_type: str, body: bytes
) -> None:
    with pytest.raises(RuntimeError):
        validate_response(status, content_type, body)
