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


def _label(pattern: str) -> re.Pattern[str]:
    return re.compile(pattern, re.IGNORECASE)


FIELD_RULES: tuple[FieldRule, ...] = (
    FieldRule(
        "vehicle_number",
        _label(r"\b(?:REGN|REGISTRATION|REG\.?)[.\s]*(?:NO\.?|NUMBER)\b"),
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
            r"\b(?:SON(?:\s*/\s*WIFE\s*/\s*DAUGHTER)?|WIFE|DAUGHTER)"
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
    FieldRule("model", _label(r"\bMODEL(?:\s+NAME)?\b"), "model"),
    FieldRule("body_type", _label(r"\bBODY\s*TYPE\b"), "body_type"),
    FieldRule(
        "vehicle_class",
        _label(r"\b(?:VEHICLE\s+CLASS|CLASS\s+OF\s+VEHICLE|CLASS)\b"),
        "text",
    ),
    FieldRule(
        "fuel_type",
        _label(r"\b(?:TYPE\s+OF\s+)?FUEL(?:\s+TYPE)?\b"),
        "fuel",
    ),
    FieldRule(
        "emission_norms",
        _label(r"\bEMISSION\s*NORMS?\b"),
        "emission",
    ),
    FieldRule("colour", _label(r"\bCOL(?:OU)?R\b"), "text"),
    FieldRule(
        "manufacturing_month_year",
        _label(
            r"\b(?:"
            r"MFG|MFD|MANUFACTURING|"
            r"MONTH\s*(?:[-/&]|AND)?\s*(?:YR\.?|YEAR)\s+OF\s+MFG\.?|"
            r"MFG\.?\s+MONTH\s*(?:[-/&]|AND)?\s*(?:YR\.?|YEAR)|"
            r"MONTH\s*/\s*YEAR\s+OF\s+MANUFACTURE"
            r")\s*(?:DATE|DT\.?|MONTH\s*/?\s*YEAR)?\b"
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
        "capacity",
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
            r"\b(?:NO\.?\s*OF\s+CYLINDERS?|NUMBER\s+OF\s+CYLINDERS?)\b|"
            r"\bCYLINDERS?\s+NO\b\.?"
        ),
        "cylinders",
    ),
    FieldRule(
        "unladen_weight",
        _label(r"\b(?:UNLADEN|ULW)\s*(?:WEIGHT|WT\.?)?\b"),
        "weight",
    ),
    FieldRule(
        "gross_vehicle_weight",
        _label(
            r"\b(?:GROSS\s+(?:VEHICLE\s+)?WEIGHT|GROSS\s+WT\.?|GVW|"
            r"LADEN\s+(?:VEHICLE\s+)?WEIGHT)\b"
        ),
        "weight",
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

    for rule in FIELD_RULES:
        candidates = _candidates_for_rule(rule, lines)
        if rule.field == "vehicle_number" and not candidates:
            candidates.extend(_unlabelled_vehicle_candidates(lines))
        if not candidates:
            continue

        value, confidence = max(candidates, key=lambda item: item[1])
        if confidence < min_confidence:
            rejected_fields.append(rule.field)
            warnings.append(
                f"{rule.field} was detected below the {min_confidence:.2f} confidence threshold."
            )
            continue

        values[rule.field] = value
        field_confidence[rule.field] = round(min(confidence, 0.9999), 4)

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
) -> list[tuple[str, float]]:
    candidates = _grouped_layout_candidates(rule, lines)
    for index, line in enumerate(lines):
        text = normalize_text(line.text)
        match = rule.label.search(text)
        if not match:
            continue

        # Combined RC technical/weight headers are positional columns. Generic
        # label extraction would otherwise reuse the first number for every field.
        if _is_combined_header(rule.field, text):
            continue

        remainder = _clean_remainder(text[match.end() :])
        remainder = _truncate_at_another_label(remainder)
        value = _normalise_value(remainder, rule.value_type)
        if value:
            candidates.append((value, line.confidence))
            continue

        spatial = _spatial_value_candidate(rule, index, lines)
        if spatial:
            candidates.append(spatial)
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


def _spatial_value_candidate(
    rule: FieldRule, label_index: int, lines: Sequence[OCRLine]
) -> tuple[str, float] | None:
    label_line = lines[label_index]
    label_box = _box_bounds(label_line)
    if not label_box:
        return None
    label_left, label_top, label_right, label_bottom = label_box
    label_height = max(1, label_bottom - label_top)
    label_width = max(1, label_right - label_left)
    ranked: list[tuple[float, OCRLine]] = []

    for index, candidate in enumerate(lines):
        if index == label_index or candidate.source != label_line.source:
            continue
        if _contains_label(candidate.text):
            continue
        box = _box_bounds(candidate)
        if not box:
            continue
        left, top, right, bottom = box
        if top < label_top - label_height:
            continue
        vertical_gap = max(0, top - label_bottom)
        if vertical_gap > max(260, label_height * 9):
            continue
        overlap_width = max(0, min(label_right, right) - max(label_left, left))
        overlaps = overlap_width > 0
        horizontal_gap = abs((left + right) / 2 - (label_left + label_right) / 2)
        if not overlaps and horizontal_gap > max(360, label_width * 3):
            continue
        if top >= label_bottom and _has_intervening_column_label(
            label_index, top, label_box, lines
        ):
            continue
        same_row_penalty = 0 if top >= label_bottom - label_height // 2 else 120
        overlap_penalty = 0 if overlaps else 500
        ranked.append(
            (
                vertical_gap * 4
                + horizontal_gap
                + same_row_penalty
                + overlap_penalty,
                candidate,
            )
        )

    for _, candidate in sorted(ranked, key=lambda item: item[0]):
        value = _normalise_value(candidate.text, rule.value_type)
        if value:
            return (value, (label_line.confidence + candidate.confidence) / 2)
    return None


def _has_intervening_column_label(
    label_index: int,
    candidate_top: int,
    label_box: tuple[int, int, int, int],
    lines: Sequence[OCRLine],
) -> bool:
    label_line = lines[label_index]
    label_left, _, label_right, label_bottom = label_box
    for index, line in enumerate(lines):
        if index == label_index or line.source != label_line.source:
            continue
        if not _contains_label(line.text):
            continue
        box = _box_bounds(line)
        if not box:
            continue
        left, top, right, _ = box
        if not label_bottom < top < candidate_top:
            continue
        if min(label_right, right) - max(label_left, left) > 0:
            return True
    return False


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
) -> list[tuple[str, float]]:
    candidates: list[tuple[str, float]] = []
    for line in lines:
        value = normalize_vehicle_number(line.text)
        if value:
            candidates.append((value, line.confidence))
    return candidates


def _clean_remainder(value: str) -> str:
    return value.strip(" \t:;|#=-/")


def _grouped_layout_candidates(
    rule: FieldRule, lines: Sequence[OCRLine]
) -> list[tuple[str, float]]:
    candidates: list[tuple[str, float]] = []
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
                    candidates.append((value, confidence))

        technical_fields = ("cubic_capacity", "horse_power", "wheel_base")
        if rule.field in technical_fields and _has_all_labels(
            current, technical_fields, field_labels
        ):
            numbers = re.findall(r"\d+(?:\.\d+)?", following)
            if len(numbers) >= 3:
                value = _normalise_value(
                    numbers[technical_fields.index(rule.field)], rule.value_type
                )
                if value:
                    candidates.append((value, confidence))

        weight_fields = ("unladen_weight", "gross_vehicle_weight")
        if rule.field in weight_fields and _has_all_labels(
            current, weight_fields, field_labels
        ):
            numbers = re.findall(r"\d+(?:\.\d+)?", following)
            if len(numbers) >= 2:
                value = _normalise_value(
                    numbers[weight_fields.index(rule.field)], rule.value_type
                )
                if value:
                    candidates.append((value, confidence))

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
                candidates.append((str(grouped[rule.field]), confidence))

    return candidates


def _has_all_labels(
    text: str,
    fields: Sequence[str],
    field_labels: dict[str, re.Pattern[str]],
) -> bool:
    return all(field_labels[field].search(text) for field in fields)


def _is_combined_header(field: str, text: str) -> bool:
    field_labels = {item.field: item.label for item in FIELD_RULES}
    technical_fields = ("cubic_capacity", "horse_power", "wheel_base")
    weight_fields = ("unladen_weight", "gross_vehicle_weight")
    return (
        field in technical_fields
        and _has_all_labels(text, technical_fields, field_labels)
    ) or (
        field in weight_fields
        and _has_all_labels(text, weight_fields, field_labels)
    )


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
    if value_type == "emission":
        match = re.search(
            r"\b(?:BHARAT\s+STAGE|BS|EURO)\s*[- ]?(?:[IVX]+|\d+)\b",
            cleaned,
            re.IGNORECASE,
        )
        return match.group(0).upper() if match else None
    if value_type == "fuel":
        upper = cleaned.upper()
        if re.search(r"PETROL.*CNG|CNG.*PETROL|DUAL.*CNG", upper):
            return "PETROL/CNG"
        if re.search(r"PETROL.*LPG|LPG.*PETROL|DUAL.*LPG", upper):
            return "PETROL/LPG"
        for pattern, fuel in (
            (r"\bDIESEL\b", "DIESEL"),
            (r"\bPETROL\b", "PETROL"),
            (r"\bCNG\b", "CNG"),
            (r"\bLPG\b", "LPG"),
            (r"\b(?:ELECTRIC|BATTERY|EV)\b", "ELECTRIC"),
            (r"\bHYBRID\b", "HYBRID"),
            (r"\bHYDROGEN\b", "HYDROGEN"),
            (r"\bFLEX\s*FUEL\b", "FLEX FUEL"),
        ):
            if re.search(pattern, upper):
                return fuel
        return None
    if value_type == "manufacturer":
        return re.sub(r"\bSUZUKIINDIA\b", "SUZUKI INDIA", cleaned, flags=re.IGNORECASE)
    if value_type == "model":
        return re.sub(r"(?<=\d)(?=[A-Z]{2,}\b)", " ", cleaned, flags=re.IGNORECASE)
    if value_type == "body_type":
        return _collapse_repeated_adjacent_phrase(cleaned)
    if value_type in {"chassis", "engine"}:
        compact = re.sub(r"[^A-Z0-9]", "", cleaned.upper())
        minimum = 8 if value_type == "chassis" else 5
        if minimum <= len(compact) <= 30 and re.search(r"\d", compact):
            return compact
        return None
    if value_type == "seats":
        match = re.fullmatch(
            r"\s*(?:\(\s*IN\s+ALL\s*\)\s*)?(?:CAPACITY|CAP\.?)?\s*:?[\s]*"
            r"(\d{1,3})\s*(?:(?:SEATS?|PERSONS?|PASSENGERS?)|"
            r"\(\s*IN\s+ALL\s*\))?\s*",
            cleaned,
            re.IGNORECASE,
        )
        if not match:
            return None
        numeric = int(match.group(1))
        return str(numeric) if 1 <= numeric <= 100 else None
    if value_type in {"capacity", "weight", "cylinders"}:
        match = re.fullmatch(
            r"\s*(?:\(\s*(?:CC|KG|KGS)\s*\)\s*)?"
            r"(\d+(?:\.\d+)?)(\s*(?:CC|KG|KGS|CYLINDERS?)?)\s*",
            cleaned,
            re.IGNORECASE,
        )
        if not match:
            return None
        number = match.group(1)
        numeric = float(number)
        if value_type == "capacity" and not 20 <= numeric <= 20_000:
            return None
        if value_type == "weight" and not 20 <= numeric <= 100_000:
            return None
        if value_type == "cylinders" and not numeric.is_integer():
            return None
        if value_type == "cylinders" and not 1 <= int(numeric) <= 16:
            return None
        if value_type == "cylinders":
            return str(int(numeric))
        if "." not in number:
            number = str(int(number))
        else:
            integer, fraction = number.split(".", 1)
            number = f"{int(integer)}.{fraction}"
        suffix = re.sub(r"\s+", " ", match.group(2).upper()).strip()
        return f"{number} {suffix}".strip()
    if value_type == "number":
        match = _NUMBER_WITH_UNIT.search(cleaned)
        return re.sub(r"\s+", " ", match.group(0).upper()) if match else None

    cleaned = cleaned.strip(".,")
    if (
        len(cleaned) < 2
        or len(cleaned) > 100
        or _contains_label(cleaned)
        or normalize_vehicle_number(cleaned) is not None
    ):
        return None
    return cleaned


def _collapse_repeated_adjacent_phrase(value: str) -> str:
    tokens = value.split()
    if len(tokens) % 2 == 0:
        midpoint = len(tokens) // 2
        if [token.upper() for token in tokens[:midpoint]] == [
            token.upper() for token in tokens[midpoint:]
        ]:
            return " ".join(tokens[:midpoint])
    return value


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
