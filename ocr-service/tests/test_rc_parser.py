from __future__ import annotations

import pytest

from app.rc_parser import merge_ocr_lines, normalize_vehicle_number, parse_rc
from app.schemas import OCRLine


def line(text: str, confidence: float = 0.9, source: str = "front") -> OCRLine:
    return OCRLine(text=text, confidence=confidence, source=source)


def boxed_line(
    text: str,
    left: int,
    top: int,
    width: int = 180,
    height: int = 30,
    confidence: float = 0.9,
    source: str = "front",
) -> OCRLine:
    return OCRLine(
        text=text,
        confidence=confidence,
        source=source,
        bounding_box=[
            [left, top],
            [left + width, top],
            [left + width, top + height],
            [left, top + height],
        ],
    )


def test_parser_extracts_common_indian_rc_labels() -> None:
    parsed = parse_rc(
        [
            line("REGN NO : GJ-16-DM-9932", 0.98),
            line("Owner Name : Raj Kumar", 0.94),
            line("Registration Date : 01/02/2020", 0.91),
            line("Valid Upto : 31/01/2035", 0.90),
            line("Chassis No : MA3EJKD1S00123456", 0.93),
            line("Engine No : K12MN1234567", 0.92),
            line("Maker : Maruti Suzuki India Ltd", 0.89),
            line("Model : Swift VXI", 0.88),
            line("Vehicle Class : MOTOR CAR", 0.87),
            line("Fuel : PETROL", 0.96),
            line("Colour : WHITE", 0.95),
            line("Mfg Date : 08/2019", 0.86),
            line("Seating Capacity : 5", 0.93),
            line("Cubic Capacity : 1197 CC", 0.90),
            line("Unladen Weight : 865 KG", 0.88),
            line("Gross Vehicle Weight : 1335 KG", 0.87),
            line("Registering Authority : RTO Ahmedabad", 0.91),
            line("Hypothecation : Example Bank Ltd", 0.84),
        ]
    )

    fields = parsed.fields
    assert fields.vehicle_number == "GJ16DM9932"
    assert fields.owner_name == "Raj Kumar"
    assert fields.registration_date == "01/02/2020"
    assert fields.registration_valid_upto == "31/01/2035"
    assert fields.chassis_number == "MA3EJKD1S00123456"
    assert fields.engine_number == "K12MN1234567"
    assert fields.manufacturer == "Maruti Suzuki India Ltd"
    assert fields.model == "Swift VXI"
    assert fields.vehicle_class == "MOTOR CAR"
    assert fields.fuel_type == "PETROL"
    assert fields.colour == "WHITE"
    assert fields.manufacturing_month_year == "08/2019"
    assert fields.seating_capacity == "5"
    assert fields.cubic_capacity == "1197 CC"
    assert fields.unladen_weight == "865 KG"
    assert fields.gross_vehicle_weight == "1335 KG"
    assert fields.registration_authority == "RTO Ahmedabad"
    assert fields.financier == "Example Bank Ltd"


def test_vehicle_number_normalization() -> None:
    assert normalize_vehicle_number("GJ 16 DM 9932") == "GJ16DM9932"
    assert normalize_vehicle_number("gj-16-dm-9932") == "GJ16DM9932"
    assert normalize_vehicle_number("22 BH 1234 AB") == "22BH1234AB"
    assert normalize_vehicle_number("not a registration") is None


def test_missing_fields_remain_null_and_generate_warnings() -> None:
    parsed = parse_rc([line("Government of Gujarat")])

    assert parsed.fields.vehicle_number is None
    assert parsed.fields.owner_name is None
    assert parsed.field_confidence == {}
    assert "vehicle_number could not be read reliably." in parsed.warnings
    assert "No reliable RC fields were found." in parsed.warnings


def test_low_confidence_value_is_not_returned() -> None:
    parsed = parse_rc([line("Owner Name: Possible Name", 0.31)], min_confidence=0.55)

    assert parsed.fields.owner_name is None
    assert any("owner_name" in warning for warning in parsed.warnings)


def test_front_back_merge_prefers_higher_confidence_candidate() -> None:
    front = [
        line("REGN NO: GJ16DM9932", 0.96, "front"),
        line("Owner Name: Low Confidence", 0.61, "front"),
    ]
    back = [
        line("Owner Name: Raj Kumar", 0.93, "back"),
        line("Engine No: K12MN1234567", 0.91, "back"),
    ]

    merged = merge_ocr_lines(front, back)
    parsed = parse_rc(merged)

    assert [item.source for item in merged] == ["front", "front", "back", "back"]
    assert parsed.fields.owner_name == "Raj Kumar"
    assert parsed.fields.engine_number == "K12MN1234567"


def test_gujarat_front_back_layout_extracts_fields_without_crossing_labels() -> None:
    parsed = parse_rc(
        [
            line(
                "Regn No GJ08DH9235 Date of Regn. 09-08-2024 "
                "Regn. Validity 08-08-2039",
                0.98,
                "front",
            ),
            line("Chassis No MBLHAW236R5B01749", 0.97, "front"),
            line("Engine/Motor No HA11E8R5B53325", 0.96, "front"),
            line("Owner Name RABARI NARSEGBHAI Owner Serial 1", 0.95, "front"),
            line(
                "Son/Wife/Daughter of (In case of Individual Owner) SAVABHAI",
                0.92,
                "front",
            ),
            line("Ownership INDIVIDUAL", 0.93, "front"),
            line(
                "Address BUKNA, BUKNA, VAV, BANASKANTHA-GUJARAT-385575",
                0.94,
                "front",
            ),
            line("Fuel PETROL Emission Norms BHARAT STAGE VI", 0.94, "front"),
            line("Vehicle Class: M-CYCLE/SCOOTER (2WN)", 0.97, "back"),
            line("Maker's Name: HERO MOTOCORP LTD", 0.96, "back"),
            line("Model Name: SPLENDOR+ (DRS)", 0.95, "back"),
            line("Colour: / Body Type:", 0.93, "back"),
            line("BLACK GREY STRIPE / SOLO WITH PILLION", 0.94, "back"),
            line("Seating(in all) Capacity 2", 0.94, "back"),
            line("Unladen Weight (Kg) 109", 0.93, "back"),
            line(
                "Cubic Cap. / Horse Power (BHP/Kw) Wheel Base(mm)",
                0.92,
                "back",
            ),
            line("97.20 / 7.91 1236", 0.93, "back"),
            line("Month-Year of Mfg. 02-2024 No. of Cylinders 1", 0.92, "back"),
            line("Financier: ROYAL FINANCE THARAD", 0.96, "back"),
            line("Registration Authority BANASKANTHA", 0.95, "back"),
            line("GJ08175196", 0.99, "back"),
        ]
    )

    assert parsed.fields.model_dump(exclude_none=True) == {
        "vehicle_number": "GJ08DH9235",
        "owner_name": "RABARI NARSEGBHAI",
        "father_or_spouse_name": "SAVABHAI",
        "ownership_type": "INDIVIDUAL",
        "address": "BUKNA, BUKNA, VAV, BANASKANTHA-GUJARAT-385575",
        "registration_date": "09-08-2024",
        "registration_valid_upto": "08-08-2039",
        "chassis_number": "MBLHAW236R5B01749",
        "engine_number": "HA11E8R5B53325",
        "manufacturer": "HERO MOTOCORP LTD",
        "model": "SPLENDOR+",
        "variant": "DRS",
        "vehicle_class": "M-CYCLE/SCOOTER (2WN)",
        "body_type": "SOLO WITH PILLION",
        "fuel_type": "PETROL",
        "emission_norms": "BHARAT STAGE VI",
        "colour": "BLACK GREY STRIPE",
        "manufacturing_month_year": "02-2024",
        "manufacturing_month": "02",
        "manufacturing_year": "2024",
        "seating_capacity": "2",
        "cubic_capacity": "97.20",
        "horse_power": "7.91",
        "wheel_base": "1236",
        "number_of_cylinders": "1",
        "unladen_weight": "109",
        "registration_authority": "BANASKANTHA",
        "financier": "ROYAL FINANCE THARAD",
    }
    assert parsed.fields.financier != "NO. OF CYLINDERS"
    assert parsed.fields.manufacturer != "GJ08175196"
    assert parsed.fields.body_type != "GJ08175196"
    assert parsed.fields.emission_norms != parsed.fields.address
    assert parsed.fields.horse_power != "97.20"
    assert parsed.fields.cubic_capacity != "7.91"
    assert parsed.fields.unladen_weight != "1236"


def test_spatial_columns_pair_each_label_with_the_value_below_it() -> None:
    parsed = parse_rc(
        [
            boxed_line("Regn No", 60, 50),
            boxed_line("Date of Regn.", 360, 50),
            boxed_line("Regn. Validity", 660, 50),
            boxed_line("GJ08DH9235", 60, 95),
            boxed_line("09-08-2024", 360, 95),
            boxed_line("08-08-2039", 660, 95),
            boxed_line("No. of Cylinders", 60, 180, source="back"),
            boxed_line("Financier", 430, 180, source="back"),
            boxed_line("1", 60, 225, source="back"),
            boxed_line("ROYAL FINANCE THARAD", 430, 225, source="back"),
        ]
    )

    assert parsed.fields.vehicle_number == "GJ08DH9235"
    assert parsed.fields.registration_date == "09-08-2024"
    assert parsed.fields.registration_valid_upto == "08-08-2039"
    assert parsed.fields.number_of_cylinders == "1"
    assert parsed.fields.financier == "ROYAL FINANCE THARAD"


def test_commercial_combined_weight_columns_remain_independent() -> None:
    parsed = parse_rc(
        [
            line("Vehicle Class: LIGHT GOODS VEHICLE", 0.96),
            line("Unladen Weight (Kg) / Gross Vehicle Weight (Kg)", 0.95),
            line("1780 / 3490", 0.94),
            line("No. of Cylinders: 4", 0.93),
            line("Financier: COMMERCIAL FINANCE LTD", 0.92),
            line("Chassis No: MA1AB2CD3EF456789", 0.96),
            line("Engine No: ENG1234567", 0.95),
        ]
    )

    assert parsed.fields.unladen_weight == "1780"
    assert parsed.fields.gross_vehicle_weight == "3490"
    assert parsed.fields.number_of_cylinders == "4"
    assert parsed.fields.financier == "COMMERCIAL FINANCE LTD"
    assert parsed.fields.chassis_number == "MA1AB2CD3EF456789"
    assert parsed.fields.engine_number == "ENG1234567"


def test_tractor_labels_do_not_leak_model_or_fuel_text_into_numeric_fields() -> None:
    parsed = parse_rc(
        [
            line("Reg. No. GJ08BB6056", 0.98),
            line("Date of Reg. 06/Dec/2016", 0.96),
            line("Vehicle Class: TRACTOR (AGRI)", 0.97),
            line("Maker's Name: ESCORTS LTD", 0.96),
            line("Model Name: FARMTRAC45", 0.95),
            line("Fuel Used", 0.94),
            line("No. of Cylinders", 0.94),
            line("3", 0.93),
            line("Registration Authority PALANPUR", 0.95),
        ]
    )

    assert parsed.fields.vehicle_number == "GJ08BB6056"
    assert parsed.fields.registration_date == "06/DEC/2016"
    assert parsed.fields.vehicle_class == "TRACTOR (AGRI)"
    assert parsed.fields.manufacturer == "ESCORTS LTD"
    assert parsed.fields.model == "FARMTRAC45"
    assert parsed.fields.registration_authority == "PALANPUR"
    assert parsed.fields.number_of_cylinders == "3"
    assert parsed.fields.fuel_type is None
    assert parsed.fields.manufacturing_year is None
    assert parsed.fields.cubic_capacity is None
    assert parsed.fields.unladen_weight is None
    assert parsed.fields.gross_vehicle_weight is None


def test_old_gujarat_form_23a_geometry_keeps_columns_and_numeric_fields_separate() -> None:
    lines = [
        boxed_line("Reg. No.", 40, 40, 170, source="front"),
        boxed_line("Date of Reg.", 300, 40, 170, source="front"),
        boxed_line("Reg. Validity", 560, 40, 180, source="front"),
        # PaddleOCR order is deliberately different from visual column order.
        boxed_line("31/12/2031", 560, 90, 180, source="front"),
        boxed_line("GJ24AA2794", 40, 90, 170, source="front"),
        boxed_line("24/05/2016", 300, 90, 170, source="front"),
        boxed_line("Owner Name: KIRANGIRI", 40, 160, 300, source="front"),
        boxed_line("Vehicle Class: MOTOR CAR", 40, 215, 330, source="front"),
        boxed_line("Fuel Used: PETROL-CNG", 40, 270, 300, source="front"),
        boxed_line("Chassis No: MA3EUA61S00868624", 40, 325, 390, source="front"),
        boxed_line("Engine No: F8DN5635307", 40, 380, 340, source="front"),
        boxed_line("Maker's Name", 300, 40, 220, source="back"),
        boxed_line("MARUTI SUZUKIINDIA LTD", 300, 85, 300, source="back"),
        boxed_line("Model Name", 300, 145, 200, source="back"),
        boxed_line("ALTO 800LXI", 300, 190, 220, source="back"),
        boxed_line("Colour: SILVER", 300, 245, 220, source="back"),
        boxed_line("Body Type: SALOON SALOON", 560, 245, 280, source="back"),
        boxed_line("Seating Capacity", 40, 300, 200, source="back"),
        boxed_line("Cylinder No.", 40, 420, 200, source="back"),
        boxed_line("03", 40, 465, 100, source="back"),
        boxed_line("005", 40, 345, 100, source="back"),
        boxed_line("Cubic Capacity", 300, 300, 220, source="back"),
        boxed_line("000796", 300, 345, 130, source="back"),
        boxed_line("Month & Yr. of Mfg.", 40, 525, 250, source="back"),
        boxed_line("MARCH 2016", 40, 570, 200, source="back"),
        boxed_line("Registration Authority", 560, 525, 260, source="back"),
        boxed_line("PATAN", 560, 570, 150, source="back"),
    ]

    parsed = parse_rc(lines)

    assert parsed.fields.vehicle_number == "GJ24AA2794"
    assert parsed.fields.registration_date == "24/05/2016"
    assert parsed.fields.vehicle_class == "MOTOR CAR"
    assert parsed.fields.owner_name == "KIRANGIRI"
    assert parsed.fields.fuel_type == "PETROL/CNG"
    assert parsed.fields.manufacturer == "MARUTI SUZUKI INDIA LTD"
    assert parsed.fields.model == "ALTO 800 LXI"
    assert parsed.fields.colour == "SILVER"
    assert parsed.fields.body_type == "SALOON"
    assert parsed.fields.seating_capacity == "5"
    assert parsed.fields.cubic_capacity == "796"
    assert parsed.fields.number_of_cylinders == "3"
    assert parsed.fields.manufacturing_month_year == "MARCH 2016"
    assert parsed.fields.manufacturing_year == "2016"
    assert parsed.fields.registration_authority == "PATAN"
    assert parsed.fields.chassis_number == "MA3EUA61S00868624"
    assert parsed.fields.engine_number == "F8DN5635307"
    assert parsed.fields.seating_capacity != "3"
    assert parsed.fields.number_of_cylinders != "5"


@pytest.mark.parametrize(
    "label",
    [
        "Date of Reg.",
        "Date of Reg",
        "Date of Registration",
        "Reg. Date",
        "Regn. Date",
    ],
)
def test_old_registration_date_label_variants(label: str) -> None:
    assert parse_rc([line(f"{label}: 24/05/2016")]).fields.registration_date == "24/05/2016"


@pytest.mark.parametrize(
    ("label", "value", "expected_month_year"),
    [
        ("Month & Yr. of Mfg.", "March 2016", "MARCH 2016"),
        ("Month & Yr of Mfg", "MAR 2016", "MAR 2016"),
        ("Month & Year of Mfg", "03/2016", "03/2016"),
        ("Month-Year of Mfg", "03-2016", "03-2016"),
        ("Mfg. Month & Year", "March 2016", "MARCH 2016"),
        ("Month / Year of Manufacture", "MAR 2016", "MAR 2016"),
    ],
)
def test_old_manufacturing_label_and_value_variants(
    label: str, value: str, expected_month_year: str
) -> None:
    fields = parse_rc([line(f"{label}: {value}")]).fields
    assert fields.manufacturing_month_year == expected_month_year
    assert fields.manufacturing_year == "2016"


@pytest.mark.parametrize(
    "label",
    [
        "Cylinder No",
        "Cylinder No.",
        "Cylinders No",
        "No. of Cylinders",
        "No of Cylinders",
        "Number of Cylinders",
    ],
)
def test_cylinder_label_variants_strip_leading_zeroes(label: str) -> None:
    assert parse_rc([line(f"{label}: 03")]).fields.number_of_cylinders == "3"
