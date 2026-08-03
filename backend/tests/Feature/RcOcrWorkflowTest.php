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
            ->assertJsonPath('data.fields.registration_valid_upto', '2039-08-08')
            ->assertJsonPath('data.fields.owner_name', 'RABARI NARSEGBHAI')
            ->assertJsonMissingPath('data.fields.customer_id')
            ->assertJsonPath('data.fields.manufacturer', 'HERO MOTOCORP LTD')
            ->assertJsonPath('data.fields.model', 'SPLENDOR+')
            ->assertJsonPath('data.fields.variant', 'DRS')
            ->assertJsonPath('data.fields.financier', 'ROYAL FINANCE THARAD')
            ->assertJsonPath('data.fields.number_of_cylinders', '1')
            ->assertJsonPath('data.fields.manufacturing_month', '02')
            ->assertJsonPath('data.fields.manufacturing_year', '2024')
            ->assertJsonPath('data.fields.cubic_capacity', '97.20')
            ->assertJsonPath('data.fields.horse_power', '7.91')
            ->assertJsonPath('data.fields.wheel_base', '1236')
            ->assertJsonPath('data.field_confidence.vehicle_category', 0.79);

        $fields = $first->json('data.fields');
        $manufacturer = DB::table('vehicle_masters')->where('id', $fields['manufacturer_id'])->first();
        $model = DB::table('vehicle_masters')->where('id', $fields['model_id'])->first();
        $variant = DB::table('vehicle_masters')->where('id', $fields['variant_id'])->first();

        $this->assertSame('HERO MOTOCORP', $manufacturer->name);
        $this->assertSame($manufacturer->id, $model->parent_id);
        $this->assertSame($model->id, $variant->parent_id);
        $this->assertSame('OCR', $variant->source);
        $this->assertSame('active', $variant->status);

        $countAfterFirst = DB::table('vehicle_masters')->where('tenant_id', $user->tenant_id)->count();
        $second = $this->actingAs($user)->post('/api/v1/ocr', [
            'document_type' => 'rc',
            'images' => [UploadedFile::fake()->create('combined.jpg', 100, 'image/jpeg')],
        ])->assertOk();

        $this->assertSame($fields['manufacturer_id'], $second->json('data.fields.manufacturer_id'));
        $this->assertSame($fields['model_id'], $second->json('data.fields.model_id'));
        $this->assertSame($fields['variant_id'], $second->json('data.fields.variant_id'));
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
            ->assertJsonPath('data.variant_id', $fields['variant_id'])
            ->assertJsonPath('data.cubic_capacity', '97.20')
            ->assertJsonPath('data.number_of_cylinders', 1)
            ->assertJsonPath('data.registration_valid_upto', '2039-08-08T00:00:00.000000Z');
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
            ->assertJsonPath('data.fields.registration_valid_upto', '2031-12-05')
            ->assertJsonPath('data.fields.chassis_number', 'T052358130')
            ->assertJsonPath('data.fields.engine_number', 'E2363463')
            ->assertJsonPath('data.fields.owner_name', 'KARSHANBHAI')
            ->assertJsonPath('data.fields.father_or_spouse_name', 'GANESHBHAI KALA')
            ->assertJsonPath('data.fields.address', 'AT-KHODA, TA-THARAD, BANASKANTHA, 385565')
            ->assertJsonPath('data.fields.vehicle_class', 'TRACTOR (AGRI)')
            ->assertJsonPath('data.fields.vehicle_type', 'tractor')
            ->assertJsonPath('data.fields.fuel_type', 'DIESEL')
            ->assertJsonPath('data.fields.seating_capacity', '1')
            ->assertJsonPath('data.fields.manufacturer', 'ESCORTS LTD')
            ->assertJsonPath('data.fields.model', 'FARMTRAC 45')
            ->assertJsonPath('data.fields.colour', 'BLUE')
            ->assertJsonPath('data.fields.vehicle_category', 'TRACTOR (OPEN)')
            ->assertJsonPath('data.fields.cubic_capacity', '45')
            ->assertJsonPath('data.fields.number_of_cylinders', '3')
            ->assertJsonPath('data.fields.manufacturing_month', '01')
            ->assertJsonPath('data.fields.manufacturing_year', '2016')
            ->assertJsonPath('data.fields.financier', 'L AND T FINANCE LTD')
            ->assertJsonPath('data.fields.registration_authority', 'PALANPUR')
            ->assertJsonPath('data.fields.district', 'PALANPUR')
            ->assertJsonPath('data.fields.state', 'Gujarat')
            ->assertJsonMissingPath('data.fields.variant')
            ->assertJsonMissingPath('data.fields.wheel_base')
            ->assertJsonMissingPath('data.fields.horse_power')
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
            'registration_date' => '06/12/2016',
            'registration_valid_upto' => '05/12/2031',
            'chassis_number' => 'T052358130',
            'engine_number' => 'E2363463',
            'owner_name' => 'KARSHANBHAI',
            'father_or_spouse_name' => 'GANESHBHAI KALA',
            'address' => 'AT-KHODA, TA-THARAD, BANASKANTHA, 385565',
            'vehicle_class' => 'TRACTOR (AGRI)',
            'fuel_type' => 'DIESEL',
            'seating_capacity' => '1',
            'manufacturer' => 'ESCORTSLTD',
            'model' => 'FARMTRAC 45',
            'colour' => 'BLUE',
            'body_type' => 'TRACTOR (OPEN)',
            'cubic_capacity' => '45',
            'number_of_cylinders' => '3',
            'manufacturing_month_year' => 'JANUARY 2016',
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
}
