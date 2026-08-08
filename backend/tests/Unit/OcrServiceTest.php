<?php

namespace Tests\Unit;

use App\Features\Ocr\Services\OcrService;
use PHPUnit\Framework\TestCase;

class OcrServiceTest extends TestCase
{
    public function test_it_parses_required_rc_fields_from_ocr_text(): void
    {
        $text = <<<'TEXT'
        REGISTRATION NO
        GJ 05 AB 1234
        Date of Registration: 7/8/2022
        Chassis No: MA3FHEB1S00A12345
        Engine No: K12MN1234567
        Class of Vehicle: MOTOR CAR LMV
        Maker's Name: MARUTI SUZUKI INDIA LTD
        Model Name: SWIFT VXI
        Colour: PEARL WHITE
        Fuel Used: PETROL
        TEXT;

        $fields = (new OcrService)->parseRc($text);

        $this->assertSame('GJ05AB1234', $fields['vehicle_number']);
        $this->assertSame('2022-08-07', $fields['registration_date']);
        $this->assertSame('MA3FHEB1S00A12345', $fields['chassis_number']);
        $this->assertSame('K12MN1234567', $fields['engine_number']);
        $this->assertSame('MOTOR CAR LMV', $fields['vehicle_class']);
        $this->assertSame('MARUTI SUZUKI INDIA LTD', $fields['manufacturer']);
        $this->assertSame('SWIFT VXI', $fields['model']);
        $this->assertSame('PEARL WHITE', $fields['colour']);
        $this->assertSame('petrol', $fields['fuel_type']);
        $this->assertSame('private_car', $fields['vehicle_type']);
    }

    public function test_it_parses_reliable_insurance_policy_fields(): void
    {
        $fields = (new OcrService)->parsePolicy(<<<'TEXT'
        Insurance Company: ACME GENERAL INSURANCE
        Policy No: POL-778899
        Name of Insured: RAJ KUMAR
        Registration No: GJ 08 AB 1234
        Policy Start: 01/08/2026
        Policy Expiry: 31/07/2027
        OD Premium: Rs. 10,000.00
        TP Premium: Rs. 3,000.00
        Net Premium: Rs. 13,000.00
        GST: Rs. 2,340.00
        Total Premium: Rs. 15,340.00
        Comprehensive Package Policy
        TEXT);

        $this->assertSame('POL-778899', $fields['policy_number']);
        $this->assertSame('GJ08AB1234', $fields['registration_number']);
        $this->assertSame('2026-08-01', $fields['policy_date']);
        $this->assertSame('2027-07-31', $fields['expiry_date']);
        $this->assertSame('10000.00', $fields['od_premium']);
        $this->assertSame('3000.00', $fields['tp_premium']);
        $this->assertSame('comprehensive', $fields['insurance_type']);
    }

    public function test_it_label_anchors_legacy_gujarat_smart_card_values(): void
    {
        $fields = (new OcrService)->parseRc(<<<'TEXT'
        Reg. No.
        GJ24AA2794
        Date of Reg.
        24/05/2016
        Owner Name: KIRANGIRI
        Vehicle Class: MOTOR CAR
        Maker's Name: MARUTI SUZUKIINDIA LTD
        Model Name: ALTO 800LXI
        Body Type: SALOON SALOON
        Fuel Used: PETROL / CNG
        Seating Capacity
        005
        Cylinder No.
        03
        Cubic Capacity
        000796
        Month & Yr. of Mfg.
        March 2016
        Registration Authority: PATAN
        Chassis No: MA3EUA61S00868624
        Engine No: F8DN5635307
        TEXT);

        $this->assertSame('GJ24AA2794', $fields['vehicle_number']);
        $this->assertSame('2016-05-24', $fields['registration_date']);
        $this->assertSame('MOTOR CAR', $fields['vehicle_class']);
        $this->assertSame('private_car', $fields['vehicle_type']);
        $this->assertSame('KIRANGIRI', $fields['owner_name']);
        $this->assertSame('PETROL+CNG', $fields['fuel_type']);
        $this->assertSame('MARUTI SUZUKI INDIA LTD', $fields['manufacturer']);
        $this->assertSame('ALTO 800 LXI', $fields['model']);
        $this->assertSame('SALOON', $fields['body_type']);
        $this->assertSame('5', $fields['seating_capacity']);
        $this->assertSame('796', $fields['cubic_capacity']);
        $this->assertSame('3', $fields['number_of_cylinders']);
        $this->assertSame('2016', $fields['manufacturing_year']);
        $this->assertSame('PATAN', $fields['registration_authority']);
        $this->assertSame('MA3EUA61S00868624', $fields['chassis_number']);
        $this->assertSame('F8DN5635307', $fields['engine_number']);

        $contamination = (new OcrService)->parseRc(<<<'TEXT'
        Seating Capacity
        Cylinder No.
        03
        TEXT);
        $this->assertArrayNotHasKey('seating_capacity', $contamination);
        $this->assertSame('3', $contamination['number_of_cylinders']);

        $explicitYear = (new OcrService)->parseRc(<<<'TEXT'
        Date of Reg.: 24/05/2017
        Month-Year of Mfg.: March 2016
        TEXT);
        $this->assertSame('2016', $explicitYear['manufacturing_year']);

        $fallbackYear = (new OcrService)->parseRc('Date of Reg.: 24/05/2017');
        $this->assertSame('2017', $fallbackYear['manufacturing_year']);
    }
}
