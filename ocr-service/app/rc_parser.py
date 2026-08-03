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
    rejected_fields: list[str]


@dataclass(frozen=True)
class FieldCandidate:
    value: str
    confidence: float
    origin: str


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
        "father_or_spouse_name",
        _label(
            r"\b(?:SON(?:\s*/\s*(?:WIFE|DAUGHTER)){0,2}|WIFE|DAUGHTER)"
            r"\s+OF(?:\s*\(.*?\))?|"
            r"\b(?:S\s*/\s*W\s*/\s*D|FATHER|HUSBAND)\s*(?:NAME|OF)?\b"
        ),
        "text",
    ),
    FieldRule("ownership_type", _label(r"\bOWNERSHIP(?:\s+TYPE)?\b"), "text"),
    FieldRule("address", _label(r"\bADDRESS\b"), "text"),
    FieldRule(
        "registration_date",
        _label(
            r"\b(?:DATE\s+OF\s+(?:REGISTRATION|REGN|REG\.?)|"
            r"(?:REGISTRATION|REGN|REG\.?)[\s.]*(?:DATE|DT\.?))\b"
        ),
        "date",
    ),
    FieldRule(
        "registration_valid_upto",
        _label(
            r"\b(?:(?:REGISTRATION|REGN|REG\.?)\s+)?"
            r"VALID(?:ITY)?\s*(?:UP\s*TO|UPTO|TILL)?\b"
        ),
        "date",
    ),
    FieldRule(
        "chassis_number",
        _label(r"\b(?:CHASSIS|CHASIS|CH)\s*(?:NO\.?|NUMBER)?\b"),
        "chassis",
    ),
    FieldRule(
        "engine_number",
        _label(r"\b(?:ENGINE(?:\s*/\s*MOTOR)?|ENG)\s*(?:NO\.?|NUMBER)?\b"),
        "engine",
    ),
    FieldRule(
        "manufacturer",
        _label(r"\b(?:MAKER(?:'?S)?(?:\s+NAME)?|MANUFACTURER)\b"),
        "manufacturer",
    ),
    FieldRule("model", _label(r"\bMODEL(?:\s+NAME)?\b"), "text"),
    FieldRule("body_type", _label(r"\bBODY\s*TYPE\b"), "text"),
    FieldRule(
        "vehicle_class",
        _label(r"\b(?:VEHICLE\s+CLASS|CLASS\s+OF\s+VEHICLE|CLASS)\b"),
        "text",
    ),
    FieldRule(
        "fuel_type",
        _label(r"\b(?:TYPE\s+OF\s+)?FUEL(?:\s+(?:TYPE|USED))?\b"),
        "fuel",
    ),
    FieldRule(
        "emission_norms",
        _label(r"\bEMISSION\s*NORMS?\b"),
        "text",
    ),
    FieldRule("colour", _label(r"\bCOL(?:OU)?R\b"), "text"),
    FieldRule(
        "manufacturing_month_year",
        _label(
            r"\b(?:MONTH\s*(?:&|AND|[-/])?\s*(?:YEAR|YR\.?)\s+OF\s+MFG\.?|"
            r"MFG|MFD|MANUFACTURING)"
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
        "horse_power",
        _label(r"\b(?:HORSE\s*POWER|BHP)(?:\s*\(.*?\))?\b"),
        "number",
    ),
    FieldRule(
        "wheel_base",
        _label(r"\bWHEEL\s*BASE(?:\s*\(.*?\))?\b"),
        "number",
    ),
    FieldRule(
        "number_of_cylinders",
        _label(
            r"\b(?:NO\.?\s+OF\s+CYLINDERS?|NUMBER\s+OF\s+CYLINDERS?|"
            r"CYLINDERS?\s*(?:NO\.?|NUMBER))\b"
        ),
        "seats",
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
        _label(
            r"\b(?:FINANC(?:I)?ER(?:\s+NAME)?|HYPOTHECATION|"
            r"HYPOTHECATED\s+TO|FINANCED\s+BY)\b"
        ),
        "text",
    ),
)

BOUNDARY_LABELS: tuple[re.Pattern[str], ...] = (
    _label(r"\bOWNER\s*SERIAL\b"),
    _label(r"\bCARD\s*ISSUE\s*DATE\b"),
    _label(r"\bREGN\.?\s*NUMBER\b"),
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
_NUMERIC_VALUE_TYPES = {"seats", "number"}
_KNOWN_FUELS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bDIESEL\b", re.IGNORECASE), "DIESEL"),
    (re.compile(r"\bPETROL\b", re.IGNORECASE), "PETROL"),
    (re.compile(r"\bCNG\b", re.IGNORECASE), "CNG"),
    (re.compile(r"\bLPG\b", re.IGNORECASE), "LPG"),
    (re.compile(r"\b(?:ELECTRIC|BATTERY|EV)\b", re.IGNORECASE), "ELECTRIC"),
    (re.compile(r"\bHYBRID\b", re.IGNORECASE), "HYBRID"),
)
_FIELD_MIN_CONFIDENCE: dict[str, float] = {
    "vehicle_number": 0.30,
    "registration_date": 0.30,
    "registration_valid_upto": 0.30,
    "chassis_number": 0.30,
    "engine_number": 0.30,
    "manufacturing_month_year": 0.35,
    "manufacturer": 0.40,
    "model": 0.40,
    "financier": 0.40,
    "colour": 0.40,
    "vehicle_class": 0.40,
    "body_type": 0.40,
    "registration_authority": 0.40,
    "fuel_type": 0.40,
    "seating_capacity": 0.40,
    "cubic_capacity": 0.40,
    "number_of_cylinders": 0.40,
    "owner_name": 0.42,
    "father_or_spouse_name": 0.42,
    "address": 0.42,
    "unladen_weight": 0.50,
    "gross_vehicle_weight": 0.50,
    "horse_power": 0.50,
    "wheel_base": 0.50,
    "emission_norms": 0.50,
}
_TEXT_REGION_FIELDS = {
    "owner_name",
    "father_or_spouse_name",
    "ownership_type",
    "address",
    "manufacturer",
    "model",
    "body_type",
    "vehicle_class",
    "colour",
    "registration_authority",
    "financier",
}
_PATTERN_FIELDS = {
    "vehicle_number",
    "registration_date",
    "registration_valid_upto",
    "chassis_number",
    "engine_number",
    "manufacturing_month_year",
}


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
    rejected_fields: list[str] = []
    claimed_numeric_origins: set[str] = set()

    for rule in FIELD_RULES:
        candidates = _candidates_for_rule(rule, lines)
        if rule.field == "vehicle_number":
            candidates.extend(_unlabelled_vehicle_candidates(lines))
        if rule.value_type in _NUMERIC_VALUE_TYPES:
            candidates = [
                candidate
                for candidate in candidates
                if candidate.origin not in claimed_numeric_origins
            ]
        if not candidates:
            continue

        selected = max(candidates, key=lambda item: item.confidence)
        value, confidence = selected.value, selected.confidence
        required_confidence = min(
            min_confidence,
            _FIELD_MIN_CONFIDENCE.get(rule.field, min_confidence),
        )
        if confidence < required_confidence:
            rejected_fields.append(rule.field)
            warnings.append(
                f"{rule.field} was detected below its {required_confidence:.2f} confidence threshold."
            )
            continue

        values[rule.field] = value
        field_confidence[rule.field] = round(min(confidence, 0.9999), 4)
        if rule.value_type in _NUMERIC_VALUE_TYPES:
            claimed_numeric_origins.add(selected.origin)

    _split_model_variant(values, field_confidence)
    _split_manufacturing_month_year(values, field_confidence)

    if values["vehicle_number"] is None:
        warnings.append("vehicle_number could not be read reliably.")
    if not any(values.values()):
        warnings.append("No reliable RC fields were found.")

    return ParsedRC(
        fields=RCFields(**values),
        field_confidence=field_confidence,
        warnings=_deduplicate(warnings),
        rejected_fields=_deduplicate(rejected_fields),
    )


def _candidates_for_rule(
    rule: FieldRule, lines: Sequence[OCRLine]
) -> list[FieldCandidate]:
    candidates = _grouped_layout_candidates(rule, lines)
    for index, line in enumerate(lines):
        text = normalize_text(line.text)
        match = rule.label.search(text)
        if not match:
            continue

        remainder = _clean_remainder(text[match.end() :])
        remainder = _truncate_at_another_label(remainder)
        value = _normalise_value(remainder, rule.value_type)
        if value:
            candidates.append(
                FieldCandidate(value, line.confidence, f"line:{index}:{match.end()}")
            )
            continue

        if rule.field == "address":
            multiline = _multiline_address_candidate(index, lines)
            if multiline:
                candidates.append(multiline)
                continue

        spatial = _spatial_value_candidate(rule, index, lines)
        if spatial:
            candidates.append(spatial)
            continue

        if line.bounding_box or index + 1 >= len(lines):
            continue
        next_line = lines[index + 1]
        if next_line.source != line.source or _contains_label(next_line.text):
            continue
        value = _normalise_value(next_line.text, rule.value_type)
        if value:
            confidence = (line.confidence + next_line.confidence) / 2
            candidates.append(
                FieldCandidate(value, confidence, f"line:{index + 1}")
            )
    return candidates


def _spatial_value_candidate(
    rule: FieldRule, label_index: int, lines: Sequence[OCRLine]
) -> FieldCandidate | None:
    label_line = lines[label_index]
    label_box = _box_bounds(label_line)
    if not label_box:
        return None
    label_left, label_top, label_right, label_bottom = label_box
    label_height = max(1, label_bottom - label_top)
    label_width = max(1, label_right - label_left)
    max_below_gap, max_column_offset, max_row_gap = _geometry_limits(
        rule, label_height, label_width
    )
    ranked: list[tuple[float, int, OCRLine]] = []

    for index, candidate in enumerate(lines):
        if index == label_index or candidate.source != label_line.source:
            continue
        if _contains_label(candidate.text):
            continue
        box = _box_bounds(candidate)
        if not box:
            continue
        left, top, right, bottom = box
        candidate_height = max(1, bottom - top)
        vertical_overlap = min(label_bottom, bottom) - max(label_top, top)
        same_row = (
            vertical_overlap >= min(label_height, candidate_height) * 0.35
            and left >= label_right - label_height
            and left - label_right <= max_row_gap
        )
        vertical_gap = top - label_bottom
        directly_below = (
            0 <= vertical_gap <= max_below_gap
            and abs(left - label_left) <= max_column_offset
        )
        if not same_row and not directly_below:
            continue
        if directly_below and _has_intervening_label(
            label_index, box, lines
        ):
            continue
        score = (
            max(0, left - label_right)
            if same_row
            else vertical_gap * 4 + abs(left - label_left)
        )
        ranked.append((score, index, candidate))

    for _, candidate_index, candidate in sorted(ranked, key=lambda item: item[0]):
        value = _normalise_value(candidate.text, rule.value_type)
        if value:
            return FieldCandidate(
                value,
                (label_line.confidence + candidate.confidence) / 2,
                f"line:{candidate_index}",
            )
    return None


def _geometry_limits(
    rule: FieldRule, label_height: int, label_width: int
) -> tuple[int, int, int]:
    if rule.field in _TEXT_REGION_FIELDS:
        return (
            max(180, label_height * 7),
            max(150, int(label_width * 1.1)),
            max(480, label_width * 3),
        )
    if rule.field in _PATTERN_FIELDS:
        return (
            max(150, label_height * 6),
            max(120, int(label_width * 0.9)),
            max(360, label_width * 3),
        )
    return (
        max(120, label_height * 5),
        max(90, int(label_width * 0.75)),
        max(300, label_width * 2),
    )


def _has_intervening_label(
    label_index: int,
    candidate_box: tuple[int, int, int, int],
    lines: Sequence[OCRLine],
) -> bool:
    label_line = lines[label_index]
    label_box = _box_bounds(label_line)
    if not label_box:
        return False
    label_left, _, label_right, label_bottom = label_box
    candidate_left, candidate_top, candidate_right, _ = candidate_box
    column_left = min(label_left, candidate_left)
    column_right = max(label_right, candidate_right)

    for index, line in enumerate(lines):
        if index == label_index or line.source != label_line.source:
            continue
        box = _box_bounds(line)
        if not box or not _contains_label(line.text):
            continue
        left, top, right, _ = box
        if top <= label_bottom or top >= candidate_top:
            continue
        horizontal_overlap = min(column_right, right) - max(column_left, left)
        if horizontal_overlap > 0 or abs(left - label_left) <= 70:
            return True
    return False


def _multiline_address_candidate(
    label_index: int, lines: Sequence[OCRLine]
) -> FieldCandidate | None:
    label = lines[label_index]
    label_box = _box_bounds(label)
    pieces: list[tuple[int, OCRLine]] = []

    if label_box:
        label_left, _, _, label_bottom = label_box
        label_height = max(1, label_box[3] - label_box[1])
        for index, candidate in enumerate(lines):
            if index == label_index or candidate.source != label.source:
                continue
            box = _box_bounds(candidate)
            if not box or _contains_label(candidate.text):
                continue
            left, top, _, _ = box
            if (
                0 <= top - label_bottom <= max(180, label_height * 8)
                and abs(left - label_left) <= max(90, (label_box[2] - label_left))
            ):
                pieces.append((index, candidate))
        pieces.sort(key=lambda item: _box_bounds(item[1])[1])  # type: ignore[index]
    else:
        for index in range(label_index + 1, min(len(lines), label_index + 4)):
            candidate = lines[index]
            if candidate.source != label.source or _contains_label(candidate.text):
                break
            pieces.append((index, candidate))

    if not pieces:
        return None
    value = _normalise_value(" ".join(line.text for _, line in pieces), "text")
    if not value:
        return None
    confidence = (label.confidence + sum(line.confidence for _, line in pieces)) / (
        len(pieces) + 1
    )
    origins = ",".join(str(index) for index, _ in pieces)
    return FieldCandidate(value, confidence, f"address:{origins}")


def _box_bounds(line: OCRLine) -> tuple[int, int, int, int] | None:
    if not line.bounding_box:
        return None
    try:
        xs = [int(point[0]) for point in line.bounding_box]
        ys = [int(point[1]) for point in line.bounding_box]
    except (IndexError, TypeError, ValueError):
        return None
    return min(xs), min(ys), max(xs), max(ys)


def _unlabelled_vehicle_candidates(
    lines: Sequence[OCRLine],
) -> list[FieldCandidate]:
    candidates: list[FieldCandidate] = []
    for index, line in enumerate(lines):
        value = normalize_vehicle_number(line.text)
        if value:
            candidates.append(FieldCandidate(value, line.confidence, f"line:{index}"))
    return candidates


def _clean_remainder(value: str) -> str:
    return value.strip(" \t:;|#=-/")


def _grouped_layout_candidates(
    rule: FieldRule, lines: Sequence[OCRLine]
) -> list[FieldCandidate]:
    candidates: list[FieldCandidate] = []
    field_labels = {item.field: item.label for item in FIELD_RULES}

    for index, line in enumerate(lines[:-1]):
        current = normalize_text(line.text)
        next_line = lines[index + 1]
        if next_line.source != line.source or _contains_label(next_line.text):
            continue
        following = normalize_text(next_line.text)
        confidence = (line.confidence + next_line.confidence) / 2

        if rule.field in {"colour", "body_type"} and all(
            field_labels[field].search(current) for field in ("colour", "body_type")
        ):
            pieces = re.split(r"\s*/\s*|\s{2,}", following, maxsplit=1)
            if len(pieces) == 2:
                position = 0 if rule.field == "colour" else 1
                value = _normalise_value(pieces[position], rule.value_type)
                if value:
                    candidates.append(
                        FieldCandidate(value, confidence, f"group:{index}:{rule.field}")
                    )

        technical_fields = ("cubic_capacity", "horse_power", "wheel_base")
        if rule.field in technical_fields and all(
            field_labels[field].search(current) for field in technical_fields
        ):
            numbers = re.findall(r"\d+(?:\.\d+)?", following)
            position = technical_fields.index(rule.field)
            required_count = 3 if rule.field == "wheel_base" else position + 1
            if len(numbers) >= required_count:
                value = _normalise_value(
                    numbers[position], rule.value_type
                )
                if value:
                    candidates.append(
                        FieldCandidate(value, confidence, f"group:{index}:{rule.field}")
                    )

        registration_fields = (
            "vehicle_number",
            "registration_date",
            "registration_valid_upto",
        )
        if rule.field in registration_fields and all(
            field_labels[field].search(current) for field in registration_fields
        ):
            registration = normalize_vehicle_number(following)
            dates = _DATE.findall(following)
            grouped: dict[str, str | None] = {
                "vehicle_number": registration,
                "registration_date": dates[0] if len(dates) >= 1 else None,
                "registration_valid_upto": dates[1] if len(dates) >= 2 else None,
            }
            if grouped[rule.field]:
                candidates.append(
                    FieldCandidate(
                        str(grouped[rule.field]),
                        confidence,
                        f"group:{index}:{rule.field}",
                    )
                )

    return candidates


def _contains_label(value: str) -> bool:
    normalized = normalize_text(value)
    return any(rule.label.search(normalized) for rule in FIELD_RULES) or any(
        label.search(normalized) for label in BOUNDARY_LABELS
    )


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
    for label in BOUNDARY_LABELS:
        match = label.search(value)
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
    if value_type == "fuel":
        for pattern, fuel in _KNOWN_FUELS:
            if pattern.search(cleaned):
                return fuel
        return None
    if value_type == "manufacturer":
        cleaned = re.sub(
            r"(?i)(?<!\s)(PVT\.?\s*LTD\.?|LTD\.?|LIMITED)$",
            r" \1",
            cleaned,
        )
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


def _split_model_variant(
    values: dict[str, str | None], field_confidence: dict[str, float]
) -> None:
    model = values.get("model")
    if not model or values.get("variant"):
        return
    match = re.fullmatch(r"(.+?)\s*\(([^()]{1,30})\)\s*", model)
    if not match:
        return
    values["model"] = _clean_remainder(match.group(1))
    values["variant"] = _clean_remainder(match.group(2))
    if "model" in field_confidence:
        field_confidence["variant"] = field_confidence["model"]


def _split_manufacturing_month_year(
    values: dict[str, str | None], field_confidence: dict[str, float]
) -> None:
    month_year = values.get("manufacturing_month_year")
    if not month_year:
        return
    numeric = re.search(r"\b(0?[1-9]|1[0-2])[./-](\d{2,4})\b", month_year)
    if numeric:
        month, year = numeric.groups()
    else:
        named = re.search(
            r"\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s/-]+(\d{2,4})\b",
            month_year,
            re.IGNORECASE,
        )
        if not named:
            return
        month = str(
            ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC").index(
                named.group(1)[:3].upper()
            )
            + 1
        )
        year = named.group(2)
    if len(year) == 2:
        year = ("19" if int(year) > 50 else "20") + year
    values["manufacturing_month"] = month.zfill(2)
    values["manufacturing_year"] = year
    if "manufacturing_month_year" in field_confidence:
        confidence = field_confidence["manufacturing_month_year"]
        field_confidence["manufacturing_month"] = confidence
        field_confidence["manufacturing_year"] = confidence
