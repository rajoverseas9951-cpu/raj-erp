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
        $this->assertSame('2039-08-08', $result['fields']['registration_valid_upto']);
        $this->assertSame('RTO AHMEDABAD', $result['fields']['registration_authority']);
        $this->assertSame('RTO AHMEDABAD', $result['fields']['district']);
        $this->assertSame('1197', $result['fields']['cubic_capacity']);
        $this->assertSame('1335', $result['fields']['gross_weight']);
        $this->assertSame('HATCHBACK', $result['fields']['vehicle_category']);
        $this->assertSame('4', $result['fields']['number_of_cylinders']);
        $this->assertSame('88.50', $result['fields']['horse_power']);
        $this->assertSame('2450', $result['fields']['wheel_base']);
        $this->assertSame('2019', $result['fields']['manufacturing_year']);
        $this->assertSame('08', $result['fields']['manufacturing_month']);
        $this->assertSame('private_car', $result['fields']['vehicle_type']);
        $this->assertSame(['Confirm all fields before saving.'], $result['warnings']);
        $this->assertSame(0.93, $result['overall_confidence']);
        $this->assertSame(0.78, $result['field_confidence']['vehicle_category']);

        Http::assertSent(fn (Request $request) =>
            $request->method() === 'POST'
            && $request->url() === 'http://ocr.internal/v1/ocr/rc'
            && str_contains((string) $request->header('Content-Type')[0], 'multipart/form-data')
        );
    }

    public function test_invalid_fuel_is_dropped_and_textual_manufacturing_month_is_normalized(): void
    {
        Http::fake([
            'http://ocr.internal/v1/ocr/rc' => Http::response([
                'success' => true,
                'fields' => [
                    'vehicle_number' => 'GJ08BB6056',
                    'manufacturer' => 'ESCORTSLTD',
                    'fuel_type' => 'USED',
                    'manufacturing_month_year' => 'JANUARY 2016',
                ],
                'field_confidence' => [
                    'manufacturer' => 0.95,
                    'fuel_type' => 0.93,
                    'manufacturing_month_year' => 0.94,
                ],
                'raw_text' => '',
                'ocr_lines' => [],
                'overall_confidence' => 0.94,
                'warnings' => [],
            ]),
        ]);

        $result = (new OcrService)->scan([
            UploadedFile::fake()->create('tractor.png', 100, 'image/png'),
        ], 'rc');

        $this->assertSame('ESCORTS LTD', $result['fields']['manufacturer']);
        $this->assertSame('01', $result['fields']['manufacturing_month']);
        $this->assertSame('2016', $result['fields']['manufacturing_year']);
        $this->assertArrayNotHasKey('fuel_type', $result['fields']);
    }

    public function test_tractor_alias_keys_are_canonicalized_without_losing_valid_values(): void
    {
        $aliasFields = [
            'registration_number' => 'GJ08BB6056',
            'date_of_regn' => '06/12/2016',
            'registration_validity' => '05/12/2031',
            'chassis_no' => 'T052358130',
            'engine_motor_no' => 'E2363463',
            'owner' => 'KARSHANBHAI',
            'son_daughter_wife_of' => 'GANESHBHAI KALA',
            'vehicle_class' => 'TRACTOR (AGRI)',
            'fuel_used' => 'DIESEL',
            'makers_name' => 'ESCORTSLTD',
            'model_name' => 'FARMTRAC 45',
            'vehicle_category' => 'TRACTOR (OPEN)',
            'color' => 'BLUE',
            'seating_in_all' => '1',
            'cubic_cap' => '45',
            'cylinder_no' => '3',
            'month_year_of_mfg' => 'JANUARY 2016',
            'financier_name' => 'L AND T FINANCE LTD',
            'registering_authority' => 'PALANPUR',
        ];
        Http::fake([
            'http://ocr.internal/v1/ocr/rc' => Http::response([
                'success' => true,
                'fields' => $aliasFields,
                'field_confidence' => array_fill_keys(array_keys($aliasFields), 0.94),
                'raw_text' => '',
                'ocr_lines' => [],
                'overall_confidence' => 0.94,
                'warnings' => [],
            ]),
        ]);

        $result = (new OcrService)->scan([
            UploadedFile::fake()->create('tractor.png', 100, 'image/png'),
        ], 'rc');

        $expected = [
            'vehicle_number' => 'GJ08BB6056',
            'registration_date' => '2016-12-06',
            'registration_valid_upto' => '2031-12-05',
            'chassis_number' => 'T052358130',
            'engine_number' => 'E2363463',
            'owner_name' => 'KARSHANBHAI',
            'father_or_spouse_name' => 'GANESHBHAI KALA',
            'vehicle_class' => 'TRACTOR (AGRI)',
            'vehicle_type' => 'tractor',
            'fuel_type' => 'DIESEL',
            'manufacturer' => 'ESCORTS LTD',
            'model' => 'FARMTRAC 45',
            'vehicle_category' => 'TRACTOR (OPEN)',
            'colour' => 'BLUE',
            'seating_capacity' => '1',
            'cubic_capacity' => '45',
            'number_of_cylinders' => '3',
            'manufacturing_month' => '01',
            'manufacturing_year' => '2016',
            'financier' => 'L AND T FINANCE LTD',
            'registration_authority' => 'PALANPUR',
            'district' => 'PALANPUR',
            'state' => 'Gujarat',
        ];
        foreach ($expected as $field => $value) {
            $this->assertSame($value, $result['fields'][$field] ?? null, $field);
        }
        $this->assertSame(0.94, $result['field_confidence']['manufacturer']);
        $this->assertSame(0.94, $result['field_confidence']['vehicle_category']);
        foreach (['variant', 'wheel_base', 'horse_power', 'unladen_weight', 'emission_norms'] as $blank) {
            $this->assertArrayNotHasKey($blank, $result['fields']);
        }
    }
}
