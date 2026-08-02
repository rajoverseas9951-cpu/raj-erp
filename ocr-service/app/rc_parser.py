from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable, Sequence

from .schemas import OCRLine, RCFields


@dataclass(frozen=True)
class FieldRule:
    field: str
    label: re.Pattern[str]
    value_type: str = "text"


@dataclass(frozen=True)
class ParsedRC:
    fields: RCFields
    field_confidence: dict[str, float]
    warnings: list[str]


def _label(pattern: str) -> re.Pattern[str]:
    return re.compile(pattern, re.IGNORECASE)


FIELD_RULES: tuple[FieldRule, ...] = (
    FieldRule(
        "vehicle_number",
        _label(r"\b(?:REGN|REGISTRATION)[.\s]*(?:NO\.?|NUMBER)\b"),
        "vehicle_number",
    ),
    FieldRule(
        "owner_name",
        _label(r"\b(?:OWNER(?:'?S)?\s*NAME|NAME\s+OF\s+OWNER)\b"),
        "text",
    ),
    FieldRule(
        "registration_date",
        _label(r"\b(?:REGISTRATION|REGN|REG\.?)[\s.]*(?:DATE|DT\.?)\b"),
        "date",
    ),
    FieldRule(
        "registration_valid_upto",
        _label(r"\b(?:REGISTRATION\s+)?VALID(?:ITY)?\s*(?:UP\s*TO|UPTO|TILL)?\b"),
        "date",
    ),
    FieldRule(
        "chassis_number",
        _label(r"\b(?:CHASSIS|CHASIS|CH)\s*(?:NO\.?|NUMBER)?\b"),
        "chassis",
    ),
    FieldRule(
        "engine_number",
        _label(r"\b(?:ENGINE|ENG)\s*(?:NO\.?|NUMBER)?\b"),
        "engine",
    ),
    FieldRule(
        "manufacturer",
        _label(r"\b(?:MAKER(?:'?S)?(?:\s+NAME)?|MANUFACTURER)\b"),
        "text",
    ),
    FieldRule("model", _label(r"\bMODEL(?:\s+NAME)?\b"), "text"),
    FieldRule(
        "vehicle_class",
        _label(r"\b(?:VEHICLE\s+CLASS|CLASS\s+OF\s+VEHICLE|CLASS)\b"),
        "text",
    ),
    FieldRule(
        "fuel_type",
        _label(r"\b(?:TYPE\s+OF\s+)?FUEL(?:\s+TYPE)?\b"),
        "text",
    ),
    FieldRule("colour", _label(r"\bCOL(?:OU)?R\b"), "text"),
    FieldRule(
        "manufacturing_month_year",
        _label(
            r"\b(?:MFG|MFD|MANUFACTURING|MONTH\s*&?\s*YEAR\s+OF\s+MFG)"
            r"\s*(?:DATE|DT\.?|MONTH\s*/?\s*YEAR)?\b"
        ),
        "month_year",
    ),
    FieldRule(
        "seating_capacity",
        _label(r"\b(?:SEATING|SEAT)\s*(?:CAPACITY|CAP\.?)?\b"),
        "seats",
    ),
    FieldRule(
        "cubic_capacity",
        _label(r"\b(?:CUBIC\s+CAPACITY|CUBIC\s+CAP\.?|CC)\b"),
        "number",
    ),
    FieldRule(
        "unladen_weight",
        _label(r"\b(?:UNLADEN|ULW)\s*(?:WEIGHT|WT\.?)?\b"),
        "number",
    ),
    FieldRule(
        "gross_vehicle_weight",
        _label(r"\b(?:GROSS\s+VEHICLE\s+WEIGHT|GROSS\s+WT\.?|GVW)\b"),
        "number",
    ),
    FieldRule(
        "registration_authority",
        _label(
            r"\b(?:REGISTERING|REGISTRATION)\s+AUTHORITY\b|"
            r"\bREG(?:ISTERING)?\.?\s+AUTH(?:ORITY)?\.?\b"
        ),
        "text",
    ),
    FieldRule(
        "financier",
        _label(r"\b(?:FINANCIER|HYPOTHECATION|HYPOTHECATED\s+TO|FINANCED\s+BY)\b"),
        "text",
    ),
)

_INDIA_REGISTRATION = re.compile(
    r"(?<![A-Z0-9])([A-Z]{2})[\s-]?(\d{1,2})[\s-]?([A-Z]{1,3})[\s-]?(\d{1,4})(?![A-Z0-9])",
    re.IGNORECASE,
)
_BH_REGISTRATION = re.compile(
    r"(?<![A-Z0-9])(\d{2})[\s-]?BH[\s-]?(\d{4})[\s-]?([A-Z]{1,2})(?![A-Z0-9])",
    re.IGNORECASE,
)
_DATE = re.compile(
    r"\b(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|"
    r"\d{1,2}[./-][A-Z]{3,9}[./-]\d{2,4})\b",
    re.IGNORECASE,
)
_MONTH_YEAR = re.compile(
    r"\b(?:(?:0?[1-9]|1[0-2])[./-]\d{2,4}|"
    r"(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s/-]+\d{2,4})\b",
    re.IGNORECASE,
)
_NUMBER_WITH_UNIT = re.compile(
    r"\b\d+(?:\.\d+)?\s*(?:CC|KG|KGS|SEATS?)\b|\b\d+(?:\.\d+)?\b",
    re.IGNORECASE,
)


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = value.replace("—", "-").replace("–", "-")
    return re.sub(r"\s+", " ", value).strip()


def normalize_vehicle_number(value: str) -> str | None:
    normalized = normalize_text(value).upper()
    match = _INDIA_REGISTRATION.search(normalized)
    if match:
        return "".join(match.groups())
    bh_match = _BH_REGISTRATION.search(normalized)
    if bh_match:
        year, serial, suffix = bh_match.groups()
        return f"{year}BH{serial}{suffix}"
    return None


def merge_ocr_lines(*groups: Iterable[OCRLine]) -> list[OCRLine]:
    """Merge front/back/combined OCR output while preserving source and order."""

    return [line for group in groups for line in group]


def parse_rc(
    lines: Sequence[OCRLine], min_confidence: float = 0.55
) -> ParsedRC:
    values: dict[str, str | None] = {
        field_name: None for field_name in RCFields.model_fields
    }
    field_confidence: dict[str, float] = {}
    warnings: list[str] = []

    for rule in FIELD_RULES:
        candidates = _candidates_for_rule(rule, lines)
        if rule.field == "vehicle_number":
            candidates.extend(_unlabelled_vehicle_candidates(lines))
        if not candidates:
            continue

        value, confidence = max(candidates, key=lambda item: item[1])
        if confidence < min_confidence:
            warnings.append(
                f"{rule.field} was detected below the {min_confidence:.2f} confidence threshold."
            )
            continue

        values[rule.field] = value
        field_confidence[rule.field] = round(min(confidence, 0.9999), 4)

    if values["vehicle_number"] is None:
        warnings.append("vehicle_number could not be read reliably.")
    if not any(values.values()):
        warnings.append("No reliable RC fields were found.")

    return ParsedRC(
        fields=RCFields(**values),
        field_confidence=field_confidence,
        warnings=_deduplicate(warnings),
    )


def _candidates_for_rule(
    rule: FieldRule, lines: Sequence[OCRLine]
) -> list[tuple[str, float]]:
    candidates: list[tuple[str, float]] = []
    for index, line in enumerate(lines):
        text = normalize_text(line.text)
        match = rule.label.search(text)
        if not match:
            continue

        remainder = _clean_remainder(text[match.end() :])
        remainder = _truncate_at_another_label(remainder)
        value = _normalise_value(remainder, rule.value_type)
        if value:
            candidates.append((value, line.confidence))
            continue

        if index + 1 >= len(lines):
            continue
        next_line = lines[index + 1]
        if next_line.source != line.source or _contains_label(next_line.text):
            continue
        value = _normalise_value(next_line.text, rule.value_type)
        if value:
            confidence = (line.confidence + next_line.confidence) / 2
            candidates.append((value, confidence))
    return candidates


def _unlabelled_vehicle_candidates(
    lines: Sequence[OCRLine],
) -> list[tuple[str, float]]:
    candidates: list[tuple[str, float]] = []
    for line in lines:
        value = normalize_vehicle_number(line.text)
        if value:
            candidates.append((value, line.confidence))
    return candidates


def _clean_remainder(value: str) -> str:
    return value.strip(" \t:;|#=-")


def _contains_label(value: str) -> bool:
    normalized = normalize_text(value)
    return any(rule.label.search(normalized) for rule in FIELD_RULES)


def _truncate_at_another_label(value: str) -> str:
    first_index: int | None = None
    for rule in FIELD_RULES:
        match = rule.label.search(value)
        # "CC" is both an RC label and a cubic-capacity unit. As a trailing
        # unit it belongs to the current value and must not trigger truncation.
        if rule.field == "cubic_capacity" and match:
            matched_label = match.group(0).strip().rstrip(".").upper()
            if matched_label == "CC":
                continue
        if match and (first_index is None or match.start() < first_index):
            first_index = match.start()
    if first_index is not None:
        value = value[:first_index]
    return _clean_remainder(value)


def _normalise_value(value: str, value_type: str) -> str | None:
    cleaned = _clean_remainder(normalize_text(value))
    if not cleaned:
        return None

    if value_type == "vehicle_number":
        return normalize_vehicle_number(cleaned)
    if value_type == "date":
        match = _DATE.search(cleaned)
        return match.group(0).upper() if match else None
    if value_type == "month_year":
        match = _MONTH_YEAR.search(cleaned)
        return match.group(0).upper() if match else None
    if value_type in {"chassis", "engine"}:
        compact = re.sub(r"[^A-Z0-9]", "", cleaned.upper())
        minimum = 8 if value_type == "chassis" else 5
        if minimum <= len(compact) <= 30 and re.search(r"\d", compact):
            return compact
        return None
    if value_type == "seats":
        match = re.search(r"\b\d{1,2}\b", cleaned)
        return match.group(0) if match else None
    if value_type == "number":
        match = _NUMBER_WITH_UNIT.search(cleaned)
        return re.sub(r"\s+", " ", match.group(0).upper()) if match else None

    cleaned = cleaned.strip(".,")
    if len(cleaned) < 2 or len(cleaned) > 100 or _contains_label(cleaned):
        return None
    return cleaned


def _deduplicate(values: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(values))
