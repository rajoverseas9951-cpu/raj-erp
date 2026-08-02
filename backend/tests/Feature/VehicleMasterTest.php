<?php

namespace Tests\Feature;

use App\Models\User;
use App\Features\Customers\Models\Customer;
use Database\Seeders\VehicleMasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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

        $this->actingAs($user)->getJson('/api/v1/vehicle-masters/models?manufacturer_id='.$manufacturerId.'&status=active')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $model->json('data.id'));

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

    public function test_unused_master_can_be_deleted_but_a_manufacturer_with_models_cannot(): void
    {
        $user = User::factory()->create(['is_admin' => true]);
        $colour = $this->actingAs($user)->postJson('/api/v1/vehicle-masters/colours', ['name' => 'Temporary Colour'])->assertCreated()->json('data.id');
        $this->actingAs($user)->deleteJson("/api/v1/vehicle-masters/colours/{$colour}")->assertOk();
        $this->actingAs($user)->getJson('/api/v1/vehicle-masters/colours')->assertOk()->assertJsonCount(0, 'data');

        $make = $this->actingAs($user)->postJson('/api/v1/vehicle-masters/manufacturers', ['name' => 'Protected Make'])->assertCreated()->json('data.id');
        $this->actingAs($user)->postJson('/api/v1/vehicle-masters/models', ['name' => 'Protected Model', 'parent_id' => $make])->assertCreated();
        $this->actingAs($user)->deleteJson("/api/v1/vehicle-masters/manufacturers/{$make}")->assertStatus(409);
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
        $manufacturers=$this->actingAs($user)->getJson('/api/v1/vehicle-masters/manufacturers')
            ->assertOk()->assertJsonCount(28,'data')->assertJsonFragment(['name'=>'MARUTI SUZUKI']);
        $manufacturerRows=collect($manufacturers->json('data'));
        $maruti=$manufacturerRows->firstWhere('name','MARUTI SUZUKI');
        $this->actingAs($user)->getJson('/api/v1/vehicle-masters/models?manufacturer_id='.$maruti['id'].'&status=active')
            ->assertOk()->assertJsonFragment(['name'=>'SWIFT'])->assertJsonFragment(['name'=>'BREZZA']);
        $hyundai=$manufacturerRows->firstWhere('name','HYUNDAI');
        $this->actingAs($user)->getJson('/api/v1/vehicle-masters/models?manufacturer_id='.$hyundai['id'].'&status=active')
            ->assertOk()->assertJsonFragment(['name'=>'CRETA'])->assertJsonMissing(['name'=>'SWIFT']);
        $hero=$manufacturerRows->firstWhere('name','HERO MOTOCORP');
        $this->actingAs($user)->getJson('/api/v1/vehicle-masters/models?manufacturer_id='.$hero['id'].'&status=active')
            ->assertOk()->assertJsonFragment(['name'=>'SPLENDOR PLUS'])->assertJsonMissing(['name'=>'CRETA']);
        $this->actingAs($user)->getJson('/api/v1/vehicle-masters/colours')
            ->assertOk()->assertJsonCount(17,'data')->assertJsonFragment(['name'=>'PEARL WHITE']);
        $this->actingAs($user)->getJson('/api/v1/vehicle-masters/vehicle_types')
            ->assertOk()->assertJsonCount(5, 'data')->assertJsonFragment(['name' => 'PRIVATE CAR']);
    }

    public function test_variants_are_model_scoped_and_master_lists_paginate(): void
    {
        $user = User::factory()->create(['is_admin' => true]);
        $make = $this->actingAs($user)->postJson('/api/v1/vehicle-masters/manufacturers', ['name' => 'Variant Make'])->assertCreated()->json('data.id');
        $model = $this->actingAs($user)->postJson('/api/v1/vehicle-masters/models', ['name' => 'Variant Model', 'parent_id' => $make])->assertCreated()->json('data.id');
        $variant = $this->actingAs($user)->postJson('/api/v1/vehicle-masters/variants', ['name' => 'Variant One', 'parent_id' => $model])->assertCreated()->json('data.id');
        $this->actingAs($user)->getJson("/api/v1/vehicle-masters/variants?model_id={$model}&status=active")
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $variant);
        $this->actingAs($user)->getJson('/api/v1/vehicle-masters/variants?paginate=1&per_page=5')
            ->assertOk()->assertJsonPath('data.total', 1)->assertJsonPath('data.data.0.id', $variant);
    }

    public function test_vehicle_save_uses_master_ids_and_persists_master_names(): void
    {
        $user=User::factory()->create(['is_admin'=>true]);
        $customer=Customer::create(['tenant_id'=>$user->tenant_id,'customer_code'=>'CUS-MASTER','first_name'=>'Master','last_name'=>'Test','mobile'=>'9999999991']);
        $this->seed(VehicleMasterSeeder::class);
        $manufacturer=DB::table('vehicle_masters')->where('tenant_id',$user->tenant_id)->where('type','manufacturers')->where('name','MARUTI SUZUKI')->first();
        $model=DB::table('vehicle_masters')->where('tenant_id',$user->tenant_id)->where('type','models')->where('parent_id',$manufacturer->id)->where('name','SWIFT')->first();
        $colour=DB::table('vehicle_masters')->where('tenant_id',$user->tenant_id)->where('type','colours')->where('name','PEARL WHITE')->first();

        $this->actingAs($user)->postJson('/api/v1/vehicles',[
            'customer_id'=>$customer->id,'vehicle_number'=>'GJ01MASTER1','chassis_number'=>'CHASSISMASTER001','engine_number'=>'ENGMASTER001',
            'manufacturer_id'=>$manufacturer->id,'model_id'=>$model->id,'colour_id'=>$colour->id,
            'insurance_status'=>'not_added','fitness_status'=>'not_added','permit_status'=>'not_added','tax_status'=>'not_added','puc_status'=>'not_added',
        ])->assertCreated()
            ->assertJsonPath('data.manufacturer_id',$manufacturer->id)->assertJsonPath('data.manufacturer','MARUTI SUZUKI')
            ->assertJsonPath('data.model_id',$model->id)->assertJsonPath('data.model','SWIFT')
            ->assertJsonPath('data.colour_id',$colour->id)->assertJsonPath('data.colour','PEARL WHITE');
    }
}
