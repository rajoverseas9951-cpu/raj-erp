<?php

namespace Tests\Feature;

use App\Features\Ocr\Services\OcrService;
use Illuminate\Config\Repository;
use Illuminate\Container\Container;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

class PaddleOcrIntegrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $application = new Container;
        Container::setInstance($application);
        $application->instance('config', new Repository([
            'services' => ['paddleocr' => ['url' => 'http://ocr.internal', 'timeout' => 100]],
        ]));
        $application->instance(Factory::class, new Factory);
        $application->instance('log', new NullLogger);
        Facade::setFacadeApplication($application);
    }

    protected function tearDown(): void
    {
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication(null);
        Container::setInstance(null);
        parent::tearDown();
    }

    public function test_rc_scan_uses_internal_paddle_service_and_maps_editable_vehicle_fields(): void
    {
        Http::fake([
            'http://ocr.internal/v1/ocr/rc' => Http::response([
                'success' => true,
                'document_type' => 'vehicle_rc',
                'fields' => [
                    'vehicle_number' => 'GJ 16 DM 9932',
                    'registration_date' => '7/8/2022',
                    'registration_valid_upto' => '08-08-2039',
                    'registration_authority' => 'RTO Ahmedabad',
                    'chassis_number' => 'MA3EJKD1S00123456',
                    'engine_number' => 'K12MN1234567',
                    'manufacturer' => 'Maruti Suzuki India Ltd',
                    'model' => 'Swift VXI',
                    'variant' => 'ZXI',
                    'vehicle_class' => 'Motor Car LMV',
                    'body_type' => 'Hatchback',
                    'fuel_type' => 'PETROL',
                    'colour' => 'Pearl White',
                    'manufacturing_month_year' => '08/2019',
                    'manufacturing_month' => '08',
                    'manufacturing_year' => '2019',
                    'seating_capacity' => '5',
                    'cubic_capacity' => '1197 CC',
                    'unladen_weight' => '865 KG',
                    'gross_vehicle_weight' => '1335 KG',
                    'number_of_cylinders' => '4',
                    'emission_norms' => 'BHARAT STAGE VI',
                    'horse_power' => '88.50',
                    'wheel_base' => '2450',
                    'financier' => 'Example Bank Ltd',
                ],
                'field_confidence' => ['vehicle_number' => 0.96, 'body_type' => 0.78],
                'raw_text' => "REGN NO: GJ16DM9932\nOwner Name: Raj Kumar",
                'ocr_lines' => [
                    ['text' => 'REGN NO: GJ16DM9932', 'confidence' => 0.96, 'source' => 'front'],
                    ['text' => 'Owner Name: Raj Kumar', 'confidence' => 0.90, 'source' => 'back'],
                ],
                'overall_confidence' => 0.93,
                'warnings' => ['Confirm all fields before saving.'],
                'processing_ms' => 123,
            ]),
        ]);

        $result = (new OcrService)->scan([
            UploadedFile::fake()->create('front.png', 100, 'image/png'),
            UploadedFile::fake()->create('back.png', 100, 'image/png'),
        ], 'rc');

        $this->assertSame('GJ16DM9932', $result['fields']['vehicle_number']);
        $this->assertSame('2022-08-07', $result['fields']['registration_date']);
        $this->assertSame('RTO AHMEDABAD', $result['fields']['registration_authority']);
        $this->assertSame('RTO AHMEDABAD', $result['fields']['district']);
        $this->assertSame('1197', $result['fields']['cubic_capacity']);
        $this->assertSame('865', $result['fields']['unladen_weight']);
        $this->assertSame('1335', $result['fields']['gross_weight']);
        $this->assertNotSame($result['fields']['unladen_weight'], $result['fields']['gross_weight']);
        $this->assertSame('HATCHBACK', $result['fields']['vehicle_category']);
        $this->assertSame('4', $result['fields']['number_of_cylinders']);
        $this->assertSame('2019', $result['fields']['manufacturing_year']);
        $this->assertSame('private_car', $result['fields']['vehicle_type']);
        $this->assertSame(['Confirm all fields before saving.'], $result['warnings']);
        $this->assertSame(0.93, $result['overall_confidence']);
        $this->assertSame(0.78, $result['field_confidence']['vehicle_category']);
        foreach ([
            'variant', 'registration_valid_upto', 'manufacturing_month', 'horse_power',
            'wheel_base', 'emission_norms', 'payment_due',
        ] as $removed) {
            $this->assertArrayNotHasKey($removed, $result['fields']);
        }

        Http::assertSent(fn (Request $request) => $request->method() === 'POST'
            && $request->url() === 'http://ocr.internal/v1/ocr/rc'
            && str_contains((string) $request->header('Content-Type')[0], 'multipart/form-data')
        );
    }

    public function test_gujarat_motorcycle_response_preserves_all_last_good_fields(): void
    {
        $fields = [
            'vehicle_number' => 'GJ08DH9235',
            'registration_date' => '09-08-2024',
            'registration_valid_upto' => '08-08-2039',
            'owner_name' => 'RABARI NARSEGBHAI',
            'father_or_spouse_name' => 'SAVABHAI',
            'ownership_type' => 'INDIVIDUAL',
            'address' => 'BUKNA, BUKNA, VAV, BANASKANTHA-GUJARAT-385575',
            'registration_authority' => 'BANASKANTHA',
            'vehicle_class' => 'M-CYCLE/SCOOTER (2WN)',
            'manufacturer' => 'HERO MOTOCORP LTD',
            'model' => 'SPLENDOR+',
            'variant' => 'DRS',
            'colour' => 'BLACK GREY STRIPE',
            'body_type' => 'SOLO WITH PILLION',
            'fuel_type' => 'PETROL',
            'emission_norms' => 'BHARAT STAGE VI',
            'seating_capacity' => '2',
            'unladen_weight' => '109',
            'cubic_capacity' => '97.20',
            'horse_power' => '7.91',
            'wheel_base' => '1236',
            'manufacturing_month_year' => '02-2024',
            'manufacturing_month' => '02',
            'manufacturing_year' => '2024',
            'number_of_cylinders' => '1',
            'chassis_number' => 'MBLHAW236R5B01749',
            'engine_number' => 'HA11E8R5B53325',
            'financier' => 'ROYAL FINANCE THARAD',
        ];
        Http::fake([
            'http://ocr.internal/v1/ocr/rc' => Http::response([
                'success' => true,
                'fields' => $fields,
                'field_confidence' => array_fill_keys(array_keys($fields), 0.94),
                'raw_text' => '',
                'ocr_lines' => [],
                'overall_confidence' => 0.94,
                'warnings' => [],
            ]),
        ]);

        $result = (new OcrService)->scan([
            UploadedFile::fake()->create('gujarat-motorcycle.jpg', 100, 'image/jpeg'),
        ], 'rc');

        $expected = [
            'vehicle_number' => 'GJ08DH9235',
            'registration_date' => '2024-08-09',
            'owner_name' => 'RABARI NARSEGBHAI',
            'father_or_spouse_name' => 'SAVABHAI',
            'ownership_type' => 'INDIVIDUAL',
            'address' => 'BUKNA, BUKNA, VAV, BANASKANTHA-GUJARAT-385575',
            'state' => 'Gujarat',
            'district' => 'BANASKANTHA',
            'registration_authority' => 'BANASKANTHA',
            'vehicle_type' => 'two_wheeler',
            'vehicle_class' => 'M-CYCLE/SCOOTER (2WN)',
            'manufacturer' => 'HERO MOTOCORP LTD',
            'model' => 'SPLENDOR PLUS',
            'vehicle_category' => 'SOLO WITH PILLION',
            'fuel_type' => 'PETROL',
            'colour' => 'BLACK GREY STRIPE',
            'manufacturing_year' => '2024',
            'seating_capacity' => '2',
            'unladen_weight' => '109',
            'cubic_capacity' => '97.20',
            'number_of_cylinders' => '1',
            'chassis_number' => 'MBLHAW236R5B01749',
            'engine_number' => 'HA11E8R5B53325',
            'financier' => 'ROYAL FINANCE THARAD',
        ];
        foreach ($expected as $field => $value) {
            $this->assertSame($value, $result['fields'][$field] ?? null, $field);
        }
        $this->assertGreaterThanOrEqual(20, count($expected));
        $this->assertNotSame('GJ08175196', $result['fields']['manufacturer']);
        $this->assertNotSame('GJ08175196', $result['fields']['vehicle_category']);
        $this->assertSame('97.20', $result['fields']['cubic_capacity']);
        $this->assertSame('109', $result['fields']['unladen_weight']);
        foreach ([
            'variant', 'registration_valid_upto', 'manufacturing_month', 'horse_power',
            'wheel_base', 'emission_norms', 'payment_due',
        ] as $removed) {
            $this->assertArrayNotHasKey($removed, $result['fields']);
        }
    }

    public function test_tractor_context_supplies_safe_editable_fallbacks_without_numeric_leakage(): void
    {
        $fields = [
            'vehicle_number' => 'GJ08BB6056',
            'registration_date' => '06/Dec/2016',
            'registration_authority' => 'PALANPUR',
            'vehicle_class' => 'TRACTOR (AGRI)',
            'manufacturer' => 'ESCORTS LTD',
            'model' => 'FARMTRAC45',
            'fuel_type' => 'USED',
            'number_of_cylinders' => '3',
        ];
        Http::fake([
            'http://ocr.internal/v1/ocr/rc' => Http::response([
                'success' => true,
                'fields' => $fields,
                'field_confidence' => array_fill_keys(array_keys($fields), 0.94),
                'raw_text' => '',
                'ocr_lines' => [],
                'overall_confidence' => 0.94,
                'warnings' => [],
            ]),
        ]);

        $result = (new OcrService)->scan([
            UploadedFile::fake()->create('tractor.jpg', 100, 'image/jpeg'),
        ], 'rc');

        $this->assertSame('GJ08BB6056', $result['fields']['vehicle_number']);
        $this->assertSame('2016-12-06', $result['fields']['registration_date']);
        $this->assertSame('tractor', $result['fields']['vehicle_type']);
        $this->assertSame('TRACTOR (AGRI)', $result['fields']['vehicle_class']);
        $this->assertSame('ESCORTS LTD', $result['fields']['manufacturer']);
        $this->assertSame('FARMTRAC45', $result['fields']['model']);
        $this->assertSame('DIESEL', $result['fields']['fuel_type']);
        $this->assertSame('2016', $result['fields']['manufacturing_year']);
        $this->assertSame('3', $result['fields']['number_of_cylinders']);
        $this->assertArrayNotHasKey('cubic_capacity', $result['fields']);
        $this->assertSame(0.55, $result['field_confidence']['manufacturing_year']);
        $this->assertSame(0.70, $result['field_confidence']['fuel_type']);
        $this->assertStringContainsString('DIESEL', implode(' ', $result['warnings']));
        $this->assertStringContainsString('Registration Date', implode(' ', $result['warnings']));
    }

    public function test_low_confidence_tractor_text_does_not_trigger_type_or_fuel_defaults(): void
    {
        Http::fake([
            'http://ocr.internal/v1/ocr/rc' => Http::response([
                'success' => true,
                'fields' => ['vehicle_class' => 'TRACTOR (AGRI)'],
                'field_confidence' => ['vehicle_class' => 0.51],
                'raw_text' => '',
                'ocr_lines' => [],
                'overall_confidence' => 0.51,
                'warnings' => [],
            ]),
        ]);

        $result = (new OcrService)->scan([
            UploadedFile::fake()->create('uncertain.jpg', 100, 'image/jpeg'),
        ], 'rc');

        $this->assertArrayNotHasKey('vehicle_type', $result['fields']);
        $this->assertArrayNotHasKey('fuel_type', $result['fields']);
    }
}
