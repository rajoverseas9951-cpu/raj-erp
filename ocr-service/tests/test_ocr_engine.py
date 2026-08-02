from __future__ import annotations

import numpy as np

from app.ocr_engine import _extract_lines


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
