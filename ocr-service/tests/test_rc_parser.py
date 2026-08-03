from __future__ import annotations

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


def test_gujarat_tractor_layout_does_not_manufacture_absent_values() -> None:
    parsed = parse_rc(
        [
            boxed_line("Reg. No.", 300, 50),
            boxed_line("Date of Reg.", 560, 50),
            boxed_line("Reg. Validity", 800, 50),
            boxed_line("GJ08BB6056", 300, 90),
            boxed_line("06/12/2016", 560, 90),
            boxed_line("05/12/2031", 800, 90),
            boxed_line("Chassis No.", 300, 150),
            boxed_line("T052358130", 300, 190),
            boxed_line("Engine No.", 300, 240),
            boxed_line("E2363463", 300, 280),
            boxed_line("Owner Name", 300, 330),
            boxed_line("KARSHANBHAI", 300, 370),
            boxed_line("Vehicle Class", 70, 330),
            boxed_line("TRACTOR (AGRI)", 70, 370),
            boxed_line("Son/Daughter/Wife of", 300, 420),
            boxed_line("GANESHBHAI KALA", 300, 460),
            boxed_line("Fuel Used", 70, 510),
            boxed_line("DIESEL", 70, 550),
            boxed_line("Address", 300, 510),
            boxed_line("AT-KHODA,", 300, 550),
            boxed_line("TA-THARAD,", 300, 585),
            boxed_line("BANASKANTHA, 385565", 300, 620),
            boxed_line("Seating Capacity", 60, 50, source="back"),
            boxed_line("1", 60, 90, source="back"),
            boxed_line("Wheel Base", 60, 150, source="back"),
            boxed_line("Cubic Capacity", 60, 230, source="back"),
            boxed_line("45", 60, 270, source="back"),
            boxed_line("Cylinder No", 60, 320, source="back"),
            boxed_line("3", 60, 360, source="back"),
            boxed_line("Cylinder Validity", 60, 410, source="back"),
            boxed_line("Month & Yr. of Mfg.", 60, 470, source="back"),
            boxed_line("JANUARY 2016", 60, 510, source="back"),
            boxed_line("Maker's Name", 320, 50, source="back"),
            boxed_line("ESCORTSLTD", 320, 90, source="back"),
            boxed_line("Model Name", 320, 180, source="back"),
            boxed_line("FARMTRAC 45", 320, 220, source="back"),
            boxed_line("Colour", 320, 290, source="back"),
            boxed_line("BLUE", 320, 330, source="back"),
            boxed_line("Body Type", 320, 400, source="back"),
            boxed_line("TRACTOR (OPEN)", 320, 440, source="back"),
            boxed_line("Financier Name", 700, 390, source="back"),
            boxed_line("L AND T FINANCE LTD", 700, 430, source="back"),
            boxed_line("Registration Authority", 700, 560, source="back"),
            boxed_line("PALANPUR", 700, 600, source="back"),
        ]
    )

    assert parsed.fields.model_dump(exclude_none=True) == {
        "vehicle_number": "GJ08BB6056",
        "owner_name": "KARSHANBHAI",
        "father_or_spouse_name": "GANESHBHAI KALA",
        "address": "AT-KHODA, TA-THARAD, BANASKANTHA, 385565",
        "registration_date": "06/12/2016",
        "registration_valid_upto": "05/12/2031",
        "chassis_number": "T052358130",
        "engine_number": "E2363463",
        "manufacturer": "ESCORTS LTD",
        "model": "FARMTRAC 45",
        "vehicle_class": "TRACTOR (AGRI)",
        "body_type": "TRACTOR (OPEN)",
        "fuel_type": "DIESEL",
        "colour": "BLUE",
        "manufacturing_month_year": "JANUARY 2016",
        "manufacturing_month": "01",
        "manufacturing_year": "2016",
        "seating_capacity": "1",
        "cubic_capacity": "45",
        "number_of_cylinders": "3",
        "registration_authority": "PALANPUR",
        "financier": "L AND T FINANCE LTD",
    }
    assert parsed.fields.wheel_base is None
    assert parsed.fields.horse_power is None
    assert parsed.fields.unladen_weight is None
    assert parsed.fields.emission_norms is None


def test_invalid_fuel_label_value_is_rejected() -> None:
    parsed = parse_rc([line("Fuel Used")])

    assert parsed.fields.fuel_type is None


def test_field_specific_thresholds_restore_valid_wide_label_regions() -> None:
    parsed = parse_rc(
        [
            boxed_line("Date of Reg.", 20, 20, confidence=0.65),
            boxed_line("06/12/2016", 480, 20, confidence=0.25),
            boxed_line("Chassis No.", 20, 80, confidence=0.65),
            boxed_line("T052358130", 480, 80, confidence=0.25),
            boxed_line("Engine No.", 20, 140, confidence=0.65),
            boxed_line("E2363463", 480, 140, confidence=0.25),
            boxed_line("Vehicle Class", 20, 200, confidence=0.65),
            boxed_line("TRACTOR (AGRI)", 480, 200, confidence=0.25),
            boxed_line("Maker's Name", 20, 260, confidence=0.65),
            boxed_line("ESCORTSLTD", 480, 260, confidence=0.25),
            boxed_line("Model Name", 20, 320, confidence=0.65),
            boxed_line("FARMTRAC 45", 480, 320, confidence=0.25),
            boxed_line("Colour", 20, 380, confidence=0.65),
            boxed_line("BLUE", 480, 380, confidence=0.25),
            boxed_line("Cubic Capacity", 20, 440, confidence=0.65),
            boxed_line("45", 480, 440, confidence=0.25),
            boxed_line("Month & Yr. of Mfg.", 20, 500, confidence=0.65),
            boxed_line("JANUARY 2016", 480, 500, confidence=0.25),
            boxed_line("Financier Name", 20, 560, confidence=0.65),
            boxed_line("L AND T FINANCE LTD", 480, 560, confidence=0.25),
        ]
    )

    assert parsed.fields.registration_date == "06/12/2016"
    assert parsed.fields.chassis_number == "T052358130"
    assert parsed.fields.engine_number == "E2363463"
    assert parsed.fields.vehicle_class == "TRACTOR (AGRI)"
    assert parsed.fields.manufacturer == "ESCORTS LTD"
    assert parsed.fields.model == "FARMTRAC 45"
    assert parsed.fields.colour == "BLUE"
    assert parsed.fields.cubic_capacity == "45"
    assert parsed.fields.manufacturing_month == "01"
    assert parsed.fields.manufacturing_year == "2016"
    assert parsed.fields.financier == "L AND T FINANCE LTD"
