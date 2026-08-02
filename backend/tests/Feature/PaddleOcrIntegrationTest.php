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
                    'registration_authority' => 'RTO Ahmedabad',
                    'chassis_number' => 'MA3EJKD1S00123456',
                    'engine_number' => 'K12MN1234567',
                    'manufacturer' => 'Maruti Suzuki India Ltd',
                    'model' => 'Swift VXI',
                    'vehicle_class' => 'Motor Car LMV',
                    'fuel_type' => 'PETROL',
                    'colour' => 'Pearl White',
                    'manufacturing_month_year' => '08/2019',
                    'seating_capacity' => '5',
                    'cubic_capacity' => '1197 CC',
                    'unladen_weight' => '865 KG',
                    'gross_vehicle_weight' => '1335 KG',
                    'financier' => 'Example Bank Ltd',
                ],
                'field_confidence' => ['vehicle_number' => 0.96],
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
        $this->assertSame('1335', $result['fields']['gross_weight']);
        $this->assertSame('2019', $result['fields']['manufacturing_year']);
        $this->assertSame('private_car', $result['fields']['vehicle_type']);
        $this->assertSame(['Confirm all fields before saving.'], $result['warnings']);
        $this->assertSame(0.93, $result['overall_confidence']);

        Http::assertSent(fn (Request $request) =>
            $request->method() === 'POST'
            && $request->url() === 'http://ocr.internal/v1/ocr/rc'
            && str_contains((string) $request->header('Content-Type')[0], 'multipart/form-data')
        );
    }
}
