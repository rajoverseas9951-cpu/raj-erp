<?php

namespace Tests\Feature;

use App\Features\Customers\Models\Customer;
use App\Features\Vehicles\Services\VehicleMasterResolver;
use App\Models\User;
use Database\Seeders\VehicleMasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RcOcrWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_gujarat_rc_resolves_hierarchy_and_does_not_duplicate_masters(): void
    {
        $user = User::factory()->create(['is_admin' => true]);
        $this->seed(VehicleMasterSeeder::class);
        Http::fake(['http://ocr.internal/v1/ocr/rc' => Http::response($this->paddlePayload())]);
        config(['services.paddleocr.url' => 'http://ocr.internal']);

        $first = $this->actingAs($user)->post('/api/v1/ocr', [
            'document_type' => 'rc',
            'images' => [
                UploadedFile::fake()->create('front.jpg', 100, 'image/jpeg'),
                UploadedFile::fake()->create('back.jpg', 100, 'image/jpeg'),
            ],
        ])->assertOk()
            ->assertJsonPath('data.fields.vehicle_number', 'GJ08DH9235')
            ->assertJsonPath('data.fields.registration_date', '2024-08-09')
            ->assertJsonPath('data.fields.owner_name', 'RABARI NARSEGBHAI')
            ->assertJsonMissingPath('data.fields.customer_id')
            ->assertJsonPath('data.fields.manufacturer', 'HERO MOTOCORP LTD')
            ->assertJsonPath('data.fields.model', 'SPLENDOR PLUS')
            ->assertJsonPath('data.fields.financier', 'ROYAL FINANCE THARAD')
            ->assertJsonPath('data.fields.number_of_cylinders', '1')
            ->assertJsonPath('data.fields.manufacturing_year', '2024')
            ->assertJsonPath('data.fields.cubic_capacity', '97.20')
            ->assertJsonPath('data.field_confidence.vehicle_category', 0.79);

        $fields = $first->json('data.fields');
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
            $this->assertSame($value, $fields[$field] ?? null, $field);
        }
        $this->assertGreaterThanOrEqual(20, count($expected));
        $this->assertNotSame('GJ08175196', $fields['manufacturer']);
        $this->assertNotSame('GJ08175196', $fields['vehicle_category']);
        $manufacturer = DB::table('vehicle_masters')->where('id', $fields['manufacturer_id'])->first();
        $model = DB::table('vehicle_masters')->where('id', $fields['model_id'])->first();

        $this->assertSame('HERO MOTOCORP', $manufacturer->name);
        $this->assertSame($manufacturer->id, $model->parent_id);
        $this->assertSame('SPLENDOR PLUS', $model->name);
        $this->assertDatabaseMissing('vehicle_masters', [
            'tenant_id' => $user->tenant_id,
            'type' => 'variants',
            'name' => 'DRS',
        ]);
        foreach ([
            'variant', 'variant_id', 'registration_valid_upto', 'manufacturing_month',
            'horse_power', 'wheel_base', 'emission_norms', 'payment_due',
        ] as $removed) {
            $this->assertArrayNotHasKey($removed, $fields);
        }

        $countAfterFirst = DB::table('vehicle_masters')->where('tenant_id', $user->tenant_id)->count();
        $second = $this->actingAs($user)->post('/api/v1/ocr', [
            'document_type' => 'rc',
            'images' => [UploadedFile::fake()->create('combined.jpg', 100, 'image/jpeg')],
        ])->assertOk();

        $this->assertSame($fields['manufacturer_id'], $second->json('data.fields.manufacturer_id'));
        $this->assertSame($fields['model_id'], $second->json('data.fields.model_id'));
        $this->assertSame(
            $countAfterFirst,
            DB::table('vehicle_masters')->where('tenant_id', $user->tenant_id)->count()
        );

        $this->actingAs($user)->postJson('/api/v1/vehicles', [
            ...$fields,
            'insurance_status' => 'not_added',
            'fitness_status' => 'not_added',
            'permit_status' => 'not_added',
            'tax_status' => 'not_added',
            'puc_status' => 'not_added',
        ])->assertUnprocessable()->assertJsonValidationErrors(['customer_id']);

        $customer = Customer::create([
            'tenant_id' => $user->tenant_id,
            'customer_code' => 'CUS-RC-OCR',
            'first_name' => 'Explicit',
            'last_name' => 'Customer',
            'mobile' => '9999999912',
        ]);
        $this->actingAs($user)->postJson('/api/v1/vehicles', [
            ...$fields,
            'customer_id' => $customer->id,
            'insurance_status' => 'not_added',
            'fitness_status' => 'not_added',
            'permit_status' => 'not_added',
            'tax_status' => 'not_added',
            'puc_status' => 'not_added',
        ])->assertCreated()
            ->assertJsonPath('data.customer_id', $customer->id)
            ->assertJsonPath('data.manufacturer_id', $fields['manufacturer_id'])
            ->assertJsonPath('data.model_id', $fields['model_id'])
            ->assertJsonPath('data.cubic_capacity', '97.20')
            ->assertJsonPath('data.number_of_cylinders', 1)
            ->assertJsonPath('data.variant_id', null)
            ->assertJsonPath('data.registration_valid_upto', null);
    }

    public function test_ocr_master_creation_is_tenant_isolated(): void
    {
        $firstUser = User::factory()->create(['is_admin' => true]);
        $secondUser = User::factory()->create(['is_admin' => true]);
        Http::fake(['http://ocr.internal/v1/ocr/rc' => Http::response($this->paddlePayload())]);
        config(['services.paddleocr.url' => 'http://ocr.internal']);

        $firstId = $this->actingAs($firstUser)->post('/api/v1/ocr', [
            'document_type' => 'rc',
            'images' => [UploadedFile::fake()->create('first.jpg', 100, 'image/jpeg')],
        ])->assertOk()->json('data.fields.manufacturer_id');
        $secondId = $this->actingAs($secondUser)->post('/api/v1/ocr', [
            'document_type' => 'rc',
            'images' => [UploadedFile::fake()->create('second.jpg', 100, 'image/jpeg')],
        ])->assertOk()->json('data.fields.manufacturer_id');

        $this->assertNotSame($firstId, $secondId);
        $this->assertDatabaseHas('vehicle_masters', [
            'id' => $firstId,
            'tenant_id' => $firstUser->tenant_id,
            'source' => 'OCR',
        ]);
        $this->assertDatabaseHas('vehicle_masters', [
            'id' => $secondId,
            'tenant_id' => $secondUser->tenant_id,
            'source' => 'OCR',
        ]);
    }

    public function test_tractor_request_cannot_inherit_motorcycle_fields_or_master_ids(): void
    {
        $user = User::factory()->create(['is_admin' => true]);
        Http::fake([
            'http://ocr.internal/v1/ocr/rc' => Http::sequence()
                ->push($this->paddlePayload())
                ->push($this->tractorPayload())
                ->push($this->tractorPayload()),
        ]);
        config(['services.paddleocr.url' => 'http://ocr.internal']);

        $motorcycle = $this->actingAs($user)->post('/api/v1/ocr', [
            'document_type' => 'rc',
            'images' => [UploadedFile::fake()->create('motorcycle.jpg', 100, 'image/jpeg')],
        ])->assertOk();
        $this->assertSame('ROYAL FINANCE THARAD', $motorcycle->json('data.fields.financier'));

        $tractor = $this->actingAs($user)->post('/api/v1/ocr', [
            'document_type' => 'rc',
            'images' => [UploadedFile::fake()->create('tractor.jpg', 100, 'image/jpeg')],
        ])->assertOk()
            ->assertJsonPath('data.fields.vehicle_number', 'GJ08BB6056')
            ->assertJsonPath('data.fields.registration_date', '2016-12-06')
            ->assertJsonPath('data.fields.chassis_number', 'T052358130')
            ->assertJsonPath('data.fields.engine_number', 'E2363463')
            ->assertJsonPath('data.fields.owner_name', 'KARSHANBHAI')
            ->assertJsonPath('data.fields.father_or_spouse_name', 'GANESHBHAI KALA')
            ->assertJsonPath('data.fields.address', 'AT-KHODA, TA-THARAD, BANASKANTHA, 385565')
            ->assertJsonPath('data.fields.vehicle_type', 'tractor')
            ->assertJsonPath('data.fields.vehicle_class', 'TRACTOR (AGRI)')
            ->assertJsonPath('data.fields.fuel_type', 'DIESEL')
            ->assertJsonPath('data.fields.seating_capacity', '1')
            ->assertJsonPath('data.fields.manufacturer', 'ESCORTS LTD')
            ->assertJsonPath('data.fields.model', 'FARMTRAC45')
            ->assertJsonPath('data.fields.colour', 'BLUE')
            ->assertJsonPath('data.fields.vehicle_category', 'TRACTOR (OPEN)')
            ->assertJsonPath('data.fields.number_of_cylinders', '3')
            ->assertJsonPath('data.fields.manufacturing_year', '2016')
            ->assertJsonPath('data.fields.financier', 'L AND T FINANCE LTD')
            ->assertJsonPath('data.fields.registration_authority', 'PALANPUR')
            ->assertJsonPath('data.fields.district', 'PALANPUR')
            ->assertJsonPath('data.fields.state', 'Gujarat')
            ->assertJsonMissingPath('data.fields.variant')
            ->assertJsonMissingPath('data.fields.registration_valid_upto')
            ->assertJsonMissingPath('data.fields.manufacturing_month')
            ->assertJsonMissingPath('data.fields.wheel_base')
            ->assertJsonMissingPath('data.fields.horse_power')
            ->assertJsonMissingPath('data.fields.cubic_capacity')
            ->assertJsonMissingPath('data.fields.unladen_weight')
            ->assertJsonMissingPath('data.fields.emission_norms');

        $this->assertNotSame(
            'ROYAL FINANCE THARAD',
            $tractor->json('data.fields.financier')
        );
        $this->assertNull($tractor->json('data.fields.horse_power'));
        $this->assertNull($tractor->json('data.fields.unladen_weight'));
        $this->assertDatabaseMissing('vehicle_masters', [
            'tenant_id' => $user->tenant_id,
            'type' => 'fuel_types',
            'name' => 'USED',
        ]);
        $this->assertNotSame(
            $motorcycle->json('data.fields.manufacturer_id'),
            $tractor->json('data.fields.manufacturer_id')
        );
        $this->assertNotSame(
            $motorcycle->json('data.fields.model_id'),
            $tractor->json('data.fields.model_id')
        );

        $masterCount = DB::table('vehicle_masters')
            ->where('tenant_id', $user->tenant_id)
            ->count();
        $repeated = $this->actingAs($user)->post('/api/v1/ocr', [
            'document_type' => 'rc',
            'images' => [UploadedFile::fake()->create('tractor-repeat.jpg', 100, 'image/jpeg')],
        ])->assertOk();

        $this->assertSame($tractor->json('data.fields.vehicle_type_id'), $repeated->json('data.fields.vehicle_type_id'));
        $this->assertSame($tractor->json('data.fields.manufacturer_id'), $repeated->json('data.fields.manufacturer_id'));
        $this->assertSame($tractor->json('data.fields.model_id'), $repeated->json('data.fields.model_id'));
        $this->assertSame(
            $masterCount,
            DB::table('vehicle_masters')->where('tenant_id', $user->tenant_id)->count()
        );
    }

    public function test_unresolved_valid_master_text_is_returned_without_an_id(): void
    {
        $user = User::factory()->create(['is_admin' => true]);

        $resolved = app(VehicleMasterResolver::class)->resolveOcrFields(
            ['model' => 'FARMTRAC 45'],
            (string) $user->tenant_id,
            (string) $user->id,
            ['model' => 0.95],
        );

        $this->assertSame('FARMTRAC 45', $resolved['fields']['model']);
        $this->assertArrayNotHasKey('model_id', $resolved['fields']);
        $this->assertSame([], $resolved['masters']);
    }

    public function test_low_confidence_master_text_is_editable_but_not_created_and_invalid_fuel_is_rejected(): void
    {
        $user = User::factory()->create(['is_admin' => true]);

        $resolved = app(VehicleMasterResolver::class)->resolveOcrFields(
            ['manufacturer' => 'ESCORTS LTD', 'fuel_type' => 'USED'],
            (string) $user->tenant_id,
            (string) $user->id,
            ['manufacturer' => 0.51, 'fuel_type' => 0.99],
        );

        $this->assertSame('ESCORTS LTD', $resolved['fields']['manufacturer']);
        $this->assertArrayNotHasKey('manufacturer_id', $resolved['fields']);
        $this->assertArrayNotHasKey('fuel_type', $resolved['fields']);
        $this->assertSame([], $resolved['masters']);
        $this->assertDatabaseMissing('vehicle_masters', [
            'tenant_id' => $user->tenant_id,
            'name' => 'USED',
        ]);
    }

    public function test_old_gujarat_smart_card_resolves_existing_masters_without_duplicates(): void
    {
        $user = User::factory()->create(['is_admin' => true]);
        $this->seed(VehicleMasterSeeder::class);
        $canonical = app(VehicleMasterResolver::class)->resolveOcrFields(
            [
                'manufacturer' => 'MARUTI SUZUKI INDIA LTD',
                'model' => 'ALTO 800 LXI',
            ],
            (string) $user->tenant_id,
            (string) $user->id,
            ['manufacturer' => 0.99, 'model' => 0.99],
        );
        Http::fake([
            'http://ocr.internal/v1/ocr/rc' => Http::sequence()
                ->push($this->oldGujaratPayload())
                ->push($this->oldGujaratPayload()),
        ]);
        config(['services.paddleocr.url' => 'http://ocr.internal']);

        $first = $this->actingAs($user)->post('/api/v1/ocr', [
            'document_type' => 'rc',
            'images' => [UploadedFile::fake()->create('gj24aa2794.jpg', 100, 'image/jpeg')],
        ])->assertOk();

        $expected = [
            'vehicle_number' => 'GJ24AA2794',
            'registration_date' => '2016-05-24',
            'vehicle_class' => 'MOTOR CAR',
            'vehicle_type' => 'private_car',
            'owner_name' => 'KIRANGIRI',
            'fuel_type' => 'PETROL/CNG',
            'manufacturer' => 'MARUTI SUZUKI INDIA LTD',
            'model' => 'ALTO 800 LXI',
            'colour' => 'SILVER',
            'vehicle_category' => 'SALOON',
            'seating_capacity' => '5',
            'cubic_capacity' => '796',
            'number_of_cylinders' => '3',
            'manufacturing_year' => '2016',
            'registration_authority' => 'PATAN',
            'chassis_number' => 'MA3EUA61S00868624',
            'engine_number' => 'F8DN5635307',
        ];
        foreach ($expected as $field => $value) {
            $this->assertSame($value, $first->json("data.fields.{$field}"), $field);
        }
        $this->assertSame(
            $canonical['fields']['manufacturer_id'],
            $first->json('data.fields.manufacturer_id')
        );
        $this->assertSame(
            $canonical['fields']['model_id'],
            $first->json('data.fields.model_id')
        );
        $fuel = DB::table('vehicle_masters')
            ->where('id', $first->json('data.fields.fuel_type_id'))
            ->first();
        $this->assertSame('PETROL+CNG', $fuel->name);

        $countAfterFirst = DB::table('vehicle_masters')
            ->where('tenant_id', $user->tenant_id)
            ->count();
        $second = $this->actingAs($user)->post('/api/v1/ocr', [
            'document_type' => 'rc',
            'images' => [UploadedFile::fake()->create('gj24aa2794-repeat.jpg', 100, 'image/jpeg')],
        ])->assertOk();

        $this->assertSame($first->json('data.fields'), $second->json('data.fields'));
        $this->assertSame(
            $countAfterFirst,
            DB::table('vehicle_masters')->where('tenant_id', $user->tenant_id)->count()
        );
    }

    public function test_commercial_weight_aliases_validate_and_legacy_fields_remain_compatible(): void
    {
        $user = User::factory()->create(['is_admin' => true]);
        $customer = Customer::create([
            'tenant_id' => $user->tenant_id,
            'customer_code' => 'CUS-COMMERCIAL',
            'first_name' => 'Commercial',
            'last_name' => 'Owner',
            'mobile' => '9999999913',
        ]);
        $payload = [
            'customer_id' => $customer->id,
            'vehicle_number' => 'GJ08CV3490',
            'vehicle_type' => 'goods_transport',
            'vehicle_class' => 'LIGHT GOODS VEHICLE',
            'vehicle_category' => 'PICKUP TRUCK',
            'chassis_number' => 'MA1AB2CD3EF456789',
            'engine_number' => 'ENG1234567',
            'unladen_weight' => 1780,
            'insurance_status' => 'not_added',
            'fitness_status' => 'not_added',
            'permit_status' => 'not_added',
            'tax_status' => 'not_added',
            'puc_status' => 'not_added',
        ];

        $this->actingAs($user)->postJson('/api/v1/vehicles', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['gross_weight']);

        $created = $this->actingAs($user)->postJson('/api/v1/vehicles', [
            ...$payload,
            'gross_vehicle_weight' => 3490,
            'variant' => 'LEGACY VARIANT',
            'manufacturing_month' => 2,
            'registration_valid_upto' => '2039-08-08',
            'horse_power' => 7.91,
            'wheel_base' => 1236,
            'emission_norms' => 'BHARAT STAGE VI',
            'payment_due' => 500,
        ])->assertCreated()
            ->assertJsonPath('data.unladen_weight', 1780)
            ->assertJsonPath('data.gross_weight', 3490)
            ->assertJsonPath('data.variant', null)
            ->assertJsonPath('data.registration_valid_upto', null);

        $vehicleId = $created->json('data.id');
        DB::table('vehicles')->where('id', $vehicleId)->update([
            'variant' => 'LEGACY VARIANT',
            'manufacturing_month' => 2,
            'registration_valid_upto' => '2039-08-08',
            'horse_power' => 7.91,
            'wheel_base' => 1236,
            'emission_norms' => 'BHARAT STAGE VI',
            'payment_due' => 500,
        ]);

        $this->actingAs($user)->getJson("/api/v1/vehicles/{$vehicleId}")
            ->assertOk()
            ->assertJsonPath('data.variant', 'LEGACY VARIANT')
            ->assertJsonPath('data.manufacturing_month', 2)
            ->assertJsonPath('data.registration_valid_upto', '2039-08-08T00:00:00.000000Z')
            ->assertJsonPath('data.horse_power', '7.91')
            ->assertJsonPath('data.wheel_base', 1236)
            ->assertJsonPath('data.emission_norms', 'BHARAT STAGE VI')
            ->assertJsonPath('data.payment_due', '500.00');
    }

    /** @return array<string, mixed> */
    private function paddlePayload(): array
    {
        $fields = [
            'vehicle_number' => 'GJ08DH9235',
            'registration_date' => '09-08-2024',
            'registration_valid_upto' => '08-08-2039',
            'chassis_number' => 'MBLHAW236R5B01749',
            'engine_number' => 'HA11E8R5B53325',
            'owner_name' => 'RABARI NARSEGBHAI',
            'father_or_spouse_name' => 'SAVABHAI',
            'ownership_type' => 'INDIVIDUAL',
            'address' => 'BUKNA, BUKNA, VAV, BANASKANTHA-GUJARAT-385575',
            'fuel_type' => 'PETROL',
            'emission_norms' => 'BHARAT STAGE VI',
            'vehicle_class' => 'M-CYCLE/SCOOTER (2WN)',
            'manufacturer' => 'HERO MOTOCORP LTD',
            'model' => 'SPLENDOR+',
            'variant' => 'DRS',
            'colour' => 'BLACK GREY STRIPE',
            'body_type' => 'SOLO WITH PILLION',
            'seating_capacity' => '2',
            'unladen_weight' => '109',
            'cubic_capacity' => '97.20',
            'horse_power' => '7.91',
            'wheel_base' => '1236',
            'manufacturing_month' => '02',
            'manufacturing_year' => '2024',
            'number_of_cylinders' => '1',
            'financier' => 'ROYAL FINANCE THARAD',
            'registration_authority' => 'BANASKANTHA',
        ];

        return [
            'success' => true,
            'document_type' => 'vehicle_rc',
            'fields' => $fields,
            'field_confidence' => array_merge(
                array_fill_keys(array_keys($fields), 0.94),
                ['body_type' => 0.79]
            ),
            'raw_text' => 'RC OCR text intentionally omitted from logs.',
            'ocr_lines' => [],
            'overall_confidence' => 0.93,
            'warnings' => [],
            'processing_ms' => 321,
        ];
    }

    /** @return array<string, mixed> */
    private function tractorPayload(): array
    {
        $fields = [
            'vehicle_number' => 'GJ08BB6056',
            'registration_date' => '06/Dec/2016',
            'registration_valid_upto' => '05/12/2031',
            'chassis_number' => 'T052358130',
            'engine_number' => 'E2363463',
            'owner_name' => 'KARSHANBHAI',
            'father_or_spouse_name' => 'GANESHBHAI KALA',
            'address' => 'AT-KHODA, TA-THARAD, BANASKANTHA, 385565',
            'vehicle_class' => 'TRACTOR (AGRI)',
            'fuel_type' => 'USED',
            'seating_capacity' => '1',
            'manufacturer' => 'ESCORTS LTD',
            'model' => 'FARMTRAC45',
            'colour' => 'BLUE',
            'body_type' => 'TRACTOR (OPEN)',
            'number_of_cylinders' => '3',
            'financier' => 'L AND T FINANCE LTD',
            'registration_authority' => 'PALANPUR',
        ];

        return [
            'success' => true,
            'document_type' => 'vehicle_rc',
            'fields' => $fields,
            'field_confidence' => array_fill_keys(array_keys($fields), 0.94),
            'raw_text' => 'Tractor RC OCR text intentionally omitted from logs.',
            'ocr_lines' => [],
            'overall_confidence' => 0.94,
            'warnings' => [],
            'processing_ms' => 280,
        ];
    }

    /** @return array<string, mixed> */
    private function oldGujaratPayload(): array
    {
        $fields = [
            'vehicle_number' => 'GJ24AA2794',
            'registration_date' => '24/05/2016',
            'vehicle_class' => 'MOTOR CAR',
            'owner_name' => 'KIRANGIRI',
            'fuel_type' => 'PETROL / CNG',
            'manufacturer' => 'MARUTI SUZUKIINDIA LTD',
            'model' => 'ALTO 800LXI',
            'colour' => 'SILVER',
            'body_type' => 'SALOON SALOON',
            'seating_capacity' => '005',
            'cubic_capacity' => '000796',
            'number_of_cylinders' => '03',
            'manufacturing_month_year' => 'MARCH 2016',
            'manufacturing_year' => '2016',
            'registration_authority' => 'PATAN',
            'chassis_number' => 'MA3EUA61S00868624',
            'engine_number' => 'F8DN5635307',
        ];

        return [
            'success' => true,
            'document_type' => 'vehicle_rc',
            'fields' => $fields,
            'field_confidence' => array_fill_keys(array_keys($fields), 0.95),
            'raw_text' => 'Old Gujarat RC OCR text intentionally omitted from logs.',
            'ocr_lines' => [],
            'overall_confidence' => 0.95,
            'warnings' => [],
            'processing_ms' => 240,
        ];
    }
}
