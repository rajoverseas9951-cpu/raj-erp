<?php

namespace Tests\Feature;

use App\Features\Customers\Models\Customer;
use App\Features\Vehicles\Models\Vehicle;
use App\Features\Vehicles\Services\VehicleModuleApplicabilityService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class VehicleOperationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_applicability_rules_cover_main_vehicle_classes(): void
    {
        $service = app(VehicleModuleApplicabilityService::class);
        [$user,$bike] = $this->vehicle('TWO_WHEELER', 'M-CYCLE/SCOOTER (2WN)', 'SOLO');
        $bikeModules = collect($service->modules($bike)['groups'])->flatten();
        $this->assertTrue($bikeModules->contains('puc'));
        $this->assertTrue($bikeModules->contains('hsrp'));
        $this->assertFalse($bikeModules->contains('fitness'));
        $this->assertFalse($bikeModules->contains('permit'));
        [, $car] = $this->vehicle('PRIVATE_CAR', 'MOTOR CAR', 'SALOON', $user);
        $carModules = collect($service->modules($car)['groups'])->flatten();
        $this->assertFalse($carModules->contains('fitness'));
        [, $taxi] = $this->vehicle('COMMERCIAL', 'PASSENGER TAXI', 'CAB', $user);
        $taxiModules = collect($service->modules($taxi)['groups'])->flatten();
        foreach (['fitness', 'permit', 'tax'] as $module) {
            $this->assertTrue($taxiModules->contains($module));
        }
        [, $goods] = $this->vehicle('TRANSPORT', 'GOODS CARRIER HGV', 'TRUCK', $user);
        $goodsModules = collect($service->modules($goods)['groups'])->flatten();
        foreach (['fitness', 'permit', 'tax', 'counter_tax', 'sld'] as $module) {
            $this->assertTrue($goodsModules->contains($module));
        }
        [, $tractor] = $this->vehicle('TRACTOR', 'TRACTOR (AGRI)', 'AGRICULTURAL NON TRANSPORT', $user);
        $tractorModules = collect($service->modules($tractor)['groups'])->flatten();
        $this->assertFalse($tractorModules->contains('fitness'));
        $this->assertFalse($tractorModules->contains('tax'));
        $this->actingAs($user)->putJson("/api/v1/vehicles/{$tractor->id}/module-override", ['module' => 'fitness', 'enabled' => true, 'reason' => 'Special transport authorization'])->assertOk();
        $this->assertDatabaseHas('vehicle_module_overrides', ['vehicle_id' => $tractor->id, 'module' => 'fitness', 'enabled' => true]);
        $overridden = $service->modules($tractor);
        $this->assertTrue(collect($overridden['groups'])->flatten()->contains('fitness'), json_encode($overridden));
    }

    public function test_puc_renewal_keeps_history_and_derives_expiry_status(): void
    {
        [$user,$vehicle] = $this->vehicle('PRIVATE_CAR', 'MOTOR CAR', 'SALOON');
        $this->actingAs($user)->postJson("/api/v1/vehicles/{$vehicle->id}/operations/puc", ['reference_number' => 'PUC-OLD', 'issue_date' => now()->subYear()->toDateString(), 'expiry_date' => now()->subDay()->toDateString(), 'amount' => 100])->assertCreated()->assertJsonPath('data.derived_status', 'EXPIRED');
        $this->actingAs($user)->postJson("/api/v1/vehicles/{$vehicle->id}/operations/puc", ['reference_number' => 'PUC-NEW', 'issue_date' => now()->toDateString(), 'expiry_date' => now()->addDays(10)->toDateString(), 'amount' => 120])->assertCreated()->assertJsonPath('data.derived_status', 'EXPIRING_SOON');
        $this->actingAs($user)->getJson("/api/v1/vehicles/{$vehicle->id}/operations/puc")->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_financial_balance_and_tenant_isolation(): void
    {
        [$user,$vehicle] = $this->vehicle('PRIVATE_CAR', 'MOTOR CAR', 'SALOON');
        $this->actingAs($user)->postJson("/api/v1/vehicles/{$vehicle->id}/operations/payment", ['reference_number' => 'INV-1', 'billed_amount' => 1500, 'paid_amount' => 900])->assertCreated();
        $this->actingAs($user)->getJson("/api/v1/vehicles/{$vehicle->id}/operational-profile")->assertOk()->assertJsonPath('data.balances.billed', 1500)->assertJsonPath('data.balances.received', 900)->assertJsonPath('data.balances.outstanding', 600);
        $other = User::factory()->create(['is_admin' => true]);
        $this->actingAs($other)->getJson("/api/v1/vehicles/{$vehicle->id}/operations/payment")->assertNotFound();
    }

    public function test_transfer_does_not_change_owner_until_completed_and_confirmed(): void
    {
        [$user,$vehicle] = $this->vehicle('PRIVATE_CAR', 'MOTOR CAR', 'SALOON');
        $old = $vehicle->customer_id;
        $new = Customer::create(['tenant_id' => $user->tenant_id, 'customer_code' => 'CUS-'.Str::random(8), 'first_name' => 'New', 'last_name' => 'Owner', 'mobile' => '8'.random_int(100000000, 999999999)]);
        $id = $this->actingAs($user)->postJson("/api/v1/vehicles/{$vehicle->id}/operations/transfer", ['new_customer_id' => $new->id, 'new_owner_name' => 'New Owner', 'status' => 'IN_PROGRESS'])->assertCreated()->json('data.id');
        $this->assertSame($old, $vehicle->fresh()->customer_id);
        $this->actingAs($user)->putJson("/api/v1/vehicles/{$vehicle->id}/operations/transfer/{$id}", ['new_customer_id' => $new->id, 'status' => 'COMPLETED', 'owner_change_confirmed' => true])->assertOk();
        $this->assertSame($new->id, $vehicle->fresh()->customer_id);
    }

    public function test_operation_documents_use_private_tenant_storage(): void
    {
        Storage::fake('local');
        [$user,$vehicle] = $this->vehicle('PRIVATE_CAR', 'MOTOR CAR', 'SALOON');
        $id = $this->actingAs($user)->postJson("/api/v1/vehicles/{$vehicle->id}/operations/puc", ['reference_number' => 'PUC-DOC'])->assertCreated()->json('data.id');
        $response = $this->actingAs($user)->post("/api/v1/vehicles/{$vehicle->id}/operations/puc/{$id}/documents", ['document' => UploadedFile::fake()->create('puc.pdf', 20, 'application/pdf')]);
        $response->assertCreated();
        $path = $response->json('data.path');
        $this->assertStringContainsString("tenants/{$user->tenant_id}/vehicles/{$vehicle->id}", $path);
        Storage::disk('local')->assertExists($path);
    }

    private function vehicle(string $type, string $class, string $category, ?User $user = null): array
    {
        $user ??= User::factory()->create(['is_admin' => true]);
        $customer = Customer::create(['tenant_id' => $user->tenant_id, 'customer_code' => 'CUS-'.Str::random(8), 'first_name' => 'Vehicle', 'last_name' => 'Owner', 'mobile' => '9'.random_int(100000000, 999999999)]);
        $vehicle = Vehicle::create(['tenant_id' => $user->tenant_id, 'customer_id' => $customer->id, 'vehicle_number' => 'GJ'.Str::upper(Str::random(8)), 'chassis_number' => Str::random(20), 'engine_number' => Str::random(20), 'vehicle_type' => $type, 'vehicle_class' => $class, 'vehicle_category' => $category, 'insurance_status' => 'not_added', 'fitness_status' => 'not_added', 'permit_status' => 'not_added', 'tax_status' => 'not_added', 'puc_status' => 'not_added']);

        return [$user, $vehicle];
    }
}
