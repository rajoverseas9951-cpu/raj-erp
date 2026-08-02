from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "vimawallah-ocr"
    engine: Literal["paddleocr"] = "paddleocr"


class OCRLine(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    confidence: float = Field(ge=0, le=1)
    source: Literal["front", "back", "combined"]
    bounding_box: list[list[int]] | None = None


class RCFields(BaseModel):
    vehicle_number: str | None = None
    owner_name: str | None = None
    registration_date: str | None = None
    registration_valid_upto: str | None = None
    chassis_number: str | None = None
    engine_number: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    vehicle_class: str | None = None
    fuel_type: str | None = None
    colour: str | None = None
    manufacturing_month_year: str | None = None
    seating_capacity: str | None = None
    cubic_capacity: str | None = None
    unladen_weight: str | None = None
    gross_vehicle_weight: str | None = None
    registration_authority: str | None = None
    financier: str | None = None


class RCOCRResponse(BaseModel):
    success: bool = True
    document_type: Literal["vehicle_rc"] = "vehicle_rc"
    fields: RCFields = Field(default_factory=RCFields)
    field_confidence: dict[str, float] = Field(default_factory=dict)
    raw_text: str = ""
    ocr_lines: list[OCRLine] = Field(default_factory=list)
    overall_confidence: float = Field(default=0, ge=0, le=1)
    warnings: list[str] = Field(default_factory=list)
    processing_ms: int = Field(default=0, ge=0)
