<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\VehicleMasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VehicleMasterTest extends TestCase
{
    use RefreshDatabase;

    public function test_sidebar_and_quick_add_use_the_same_tenant_scoped_vehicle_masters(): void
    {
        $user = User::factory()->create(['is_admin' => true]);
        $other = User::factory()->create(['is_admin' => true]);

        $manufacturer = $this->actingAs($user)->postJson('/api/v1/vehicle-masters/manufacturers', [
            'name' => 'Maruti Suzuki', 'code' => 'MSIL',
        ])->assertCreated()->assertJsonPath('data.name', 'MARUTI SUZUKI');

        $manufacturerId = $manufacturer->json('data.id');
        $model = $this->actingAs($user)->postJson('/api/v1/vehicle-masters/models', [
            'name' => 'Swift', 'parent_id' => $manufacturerId,
        ])->assertCreated()->assertJsonPath('data.name', 'SWIFT');

        $this->actingAs($user)->postJson('/api/v1/vehicle-masters/colours', [
            'name' => 'Pearl White',
        ])->assertCreated();

        $this->actingAs($user)->getJson('/api/v1/vehicle-masters/models')
            ->assertOk()
            ->assertJsonPath('data.0.id', $model->json('data.id'))
            ->assertJsonPath('data.0.parent_name', 'MARUTI SUZUKI');

        $this->actingAs($user)->putJson("/api/v1/vehicle-masters/models/{$model->json('data.id')}", [
            'status' => 'inactive',
        ])->assertOk()->assertJsonPath('data.status', 'inactive');

        $this->actingAs($other)->getJson('/api/v1/vehicle-masters/manufacturers')
            ->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_vehicle_model_requires_a_manufacturer_from_the_same_tenant(): void
    {
        $user = User::factory()->create(['is_admin' => true]);

        $this->actingAs($user)->postJson('/api/v1/vehicle-masters/models', [
            'name' => 'Orphan Model',
        ])->assertUnprocessable()->assertJsonValidationErrors(['parent_id']);
    }

    public function test_default_vehicle_classes_body_types_and_fuel_types_are_seeded(): void
    {
        $user = User::factory()->create(['is_admin' => true]);
        $this->seed(VehicleMasterSeeder::class);

        $this->actingAs($user)->getJson('/api/v1/vehicle-masters/fuel_types')
            ->assertOk()->assertJsonCount(10, 'data')
            ->assertJsonFragment(['name' => 'PETROL'])
            ->assertJsonFragment(['name' => 'FLEX FUEL']);
        $this->actingAs($user)->getJson('/api/v1/vehicle-masters/vehicle_classes')
            ->assertOk()->assertJsonCount(7, 'data')
            ->assertJsonFragment(['name' => 'MCWG']);
        $this->actingAs($user)->getJson('/api/v1/vehicle-masters/body_types')
            ->assertOk()->assertJsonCount(19, 'data')
            ->assertJsonFragment(['name' => 'MOTORCYCLE']);
    }
}
