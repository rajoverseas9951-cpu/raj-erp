from __future__ import annotations

import io

from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.main import create_app
from app.schemas import OCRLine


class FakeEngine:
    def __init__(self) -> None:
        self.sources: list[str] = []

    def recognize(self, image, source: str) -> list[OCRLine]:
        self.sources.append(source)
        if source == "front":
            return [
                OCRLine(
                    text="REGN NO: GJ 16 DM 9932",
                    confidence=0.97,
                    source="front",
                ),
                OCRLine(
                    text="Owner Name: Raj Kumar",
                    confidence=0.92,
                    source="front",
                ),
            ]
        if source == "back":
            return [
                OCRLine(
                    text="Chassis No: MA3EJKD1S00123456",
                    confidence=0.91,
                    source="back",
                ),
                OCRLine(
                    text="Engine No: K12MN1234567",
                    confidence=0.90,
                    source="back",
                ),
            ]
        return []


def png_bytes() -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (64, 32), "white").save(output, format="PNG")
    return output.getvalue()


def test_health_endpoint_and_single_startup_initialization() -> None:
    factory_calls = 0

    def factory(settings: Settings) -> FakeEngine:
        nonlocal factory_calls
        factory_calls += 1
        return FakeEngine()

    app = create_app(Settings(), engine_factory=factory)
    with TestClient(app) as client:
        first = client.get("/health")
        second = client.get("/health")

    assert first.status_code == 200
    assert first.json() == {
        "status": "ok",
        "service": "vimawallah-ocr",
        "engine": "paddleocr",
    }
    assert second.status_code == 200
    assert factory_calls == 1


def test_rejects_unsupported_file() -> None:
    app = create_app(Settings(), engine_factory=lambda settings: FakeEngine())
    with TestClient(app) as client:
        response = client.post(
            "/v1/ocr/rc",
            files={"front": ("rc.pdf", b"not-a-pdf", "application/pdf")},
        )

    assert response.status_code == 415
    assert "jpg" in response.json()["detail"]


def test_rejects_oversized_total_upload() -> None:
    settings = Settings(max_upload_bytes=10, upload_chunk_bytes=65_536)
    app = create_app(settings, engine_factory=lambda current: FakeEngine())
    with TestClient(app) as client:
        response = client.post(
            "/v1/ocr/rc",
            files={"front": ("rc.jpg", b"x" * 11, "image/jpeg")},
        )

    assert response.status_code == 413
    assert response.json()["detail"] == "Total upload exceeds 10 bytes."


def test_rejects_empty_upload() -> None:
    app = create_app(Settings(), engine_factory=lambda settings: FakeEngine())
    with TestClient(app) as client:
        response = client.post(
            "/v1/ocr/rc",
            files={"front": ("rc.png", b"", "image/png")},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "front is empty."


def test_front_and_back_are_processed_separately_then_merged() -> None:
    engine = FakeEngine()
    app = create_app(Settings(), engine_factory=lambda settings: engine)
    image = png_bytes()

    with TestClient(app) as client:
        response = client.post(
            "/v1/ocr/rc",
            files={
                "front": ("front.png", image, "image/png"),
                "back": ("back.png", image, "image/png"),
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["document_type"] == "vehicle_rc"
    assert body["fields"]["vehicle_number"] == "GJ16DM9932"
    assert body["fields"]["owner_name"] == "Raj Kumar"
    assert body["fields"]["chassis_number"] == "MA3EJKD1S00123456"
    assert body["fields"]["engine_number"] == "K12MN1234567"
    assert [line["source"] for line in body["ocr_lines"]] == [
        "front",
        "front",
        "back",
        "back",
    ]
    assert engine.sources == ["front", "back"]
    assert body["overall_confidence"] < 1


def test_requires_at_least_one_image() -> None:
    app = create_app(Settings(), engine_factory=lambda settings: FakeEngine())
    with TestClient(app) as client:
        response = client.post("/v1/ocr/rc")

    assert response.status_code == 400


def test_sequential_rc_requests_never_share_parsed_fields() -> None:
    class SequentialEngine:
        def __init__(self) -> None:
            self.calls = 0

        def recognize(self, image, source: str) -> list[OCRLine]:
            self.calls += 1
            texts = (
                [
                    "REGN NO: GJ08DH9235",
                    "Financier: ROYAL FINANCE THARAD",
                    "Cubic Capacity: 97.20",
                    "Unladen Weight: 109",
                    "Emission Norms: BHARAT STAGE VI",
                ]
                if self.calls == 1
                else [
                    "REGN NO: GJ08BB6056",
                    "Date of Reg.: 06/12/2016",
                    "Reg. Validity: 05/12/2031",
                    "Fuel: DIESEL",
                    "Maker's Name: ESCORTS LTD",
                    "Model Name: FARMTRAC 45",
                    "Cubic Capacity: 45",
                    "No. of Cylinders: 3",
                    "Month-Year of Mfg. JANUARY 2016",
                    "Financier: L AND T FINANCE LTD",
                ]
            )
            return [
                OCRLine(text=text, confidence=0.95, source=source) for text in texts
            ]

    engine = SequentialEngine()
    app = create_app(Settings(), engine_factory=lambda settings: engine)
    image = png_bytes()

    with TestClient(app) as client:
        motorcycle = client.post(
            "/v1/ocr/rc",
            files={"combined": ("motorcycle.png", image, "image/png")},
        ).json()
        tractor = client.post(
            "/v1/ocr/rc",
            files={"combined": ("tractor.png", image, "image/png")},
        ).json()

    assert motorcycle["fields"]["financier"] == "ROYAL FINANCE THARAD"
    assert motorcycle["fields"]["cubic_capacity"] == "97.20"
    assert motorcycle["fields"]["unladen_weight"] == "109"
    assert tractor["fields"]["vehicle_number"] == "GJ08BB6056"
    assert tractor["fields"]["fuel_type"] == "DIESEL"
    assert tractor["fields"]["manufacturer"] == "ESCORTS LTD"
    assert tractor["fields"]["manufacturing_month"] == "01"
    assert tractor["fields"]["manufacturing_year"] == "2016"
    assert tractor["fields"]["number_of_cylinders"] == "3"
    assert tractor["fields"]["financier"] == "L AND T FINANCE LTD"
    assert tractor["fields"]["cubic_capacity"] == "45"
    assert tractor["fields"]["wheel_base"] is None
    assert tractor["fields"]["horse_power"] is None
    assert tractor["fields"]["unladen_weight"] is None
    assert tractor["fields"]["emission_norms"] is None
    assert "ROYAL FINANCE THARAD" not in tractor["raw_text"]
    assert "97.20" not in tractor["raw_text"]
    assert "109" not in tractor["raw_text"]
