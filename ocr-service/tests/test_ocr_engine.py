from __future__ import annotations

import os
import sys
from types import ModuleType

import numpy as np

from app.config import Settings
from app.ocr_engine import PaddleOCREngine, _extract_lines


def test_extracts_current_paddle_result_with_numpy_arrays() -> None:
    result = {
        "res": {
            "rec_texts": ["REGN NO: GJ16DM9932"],
            "rec_scores": np.array([0.9345]),
            "rec_polys": np.array(
                [[[10, 20], [210, 20], [210, 50], [10, 50]]], dtype=np.int16
            ),
        }
    }

    lines = _extract_lines(result, "front")

    assert len(lines) == 1
    assert lines[0].text == "REGN NO: GJ16DM9932"
    assert lines[0].confidence == 0.9345
    assert lines[0].source == "front"
    assert lines[0].bounding_box == [[10, 20], [210, 20], [210, 50], [10, 50]]


def test_initialize_forces_cpu_without_mkldnn(monkeypatch, tmp_path) -> None:
    constructor_options = {}

    class FakePaddleOCR:
        def __init__(self, **kwargs) -> None:
            constructor_options.update(kwargs)

    paddle = ModuleType("paddle")
    paddle.__version__ = "3.2.2"
    paddleocr = ModuleType("paddleocr")
    paddleocr.__version__ = "3.4.1"
    paddleocr.PaddleOCR = FakePaddleOCR
    paddlex = ModuleType("paddlex")
    paddlex.__version__ = "3.4.3"

    monkeypatch.setitem(sys.modules, "paddle", paddle)
    monkeypatch.setitem(sys.modules, "paddleocr", paddleocr)
    monkeypatch.setitem(sys.modules, "paddlex", paddlex)
    monkeypatch.setenv("FLAGS_use_mkldnn", "1")

    engine = PaddleOCREngine(Settings(model_cache_dir=tmp_path))
    engine.initialize()

    assert constructor_options["device"] == "cpu"
    assert constructor_options["enable_mkldnn"] is False
    assert constructor_options["cpu_threads"] == 2
    assert constructor_options["text_detection_model_name"] == "PP-OCRv5_mobile_det"
    assert constructor_options["text_recognition_model_name"] == "PP-OCRv5_mobile_rec"
    assert constructor_options["use_doc_unwarping"] is False
    assert constructor_options["use_textline_orientation"] is False
    assert constructor_options["use_doc_orientation_classify"] is True
    assert os.environ["FLAGS_use_mkldnn"] == "0"
