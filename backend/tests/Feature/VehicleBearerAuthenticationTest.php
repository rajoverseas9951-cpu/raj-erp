<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VehicleBearerAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_vehicle_create_update_and_delete_use_bearer_token_without_csrf(): void
    {
        $user = User::factory()->create(['is_admin' => true, 'is_active' => true]);
        $customer = Customer::create([
            'tenant_id' => $user->tenant_id,
            'customer_code' => 'CUS-BEARER',
            'first_name' => 'Bearer',
            'last_name' => 'Owner',
            'mobile' => '9999999988',
        ]);
        $token = $user->createToken('vehicle-test')->plainTextToken;
        $headers = ['Origin' => 'https://erp.vimawallah.com'];
        $payload = [
            'customer_id' => $customer->id,
            'vehicle_number' => 'GJ01BEARER1',
            'chassis_number' => 'BEARERCHASSIS001',
            'engine_number' => 'BEARERENGINE001',
            'insurance_status' => 'not_added',
            'fitness_status' => 'not_added',
            'permit_status' => 'not_added',
            'tax_status' => 'not_added',
            'puc_status' => 'not_added',
        ];

        $created = $this->withToken($token)->withHeaders($headers)
            ->postJson('/api/v1/vehicles', $payload)
            ->assertCreated()
            ->assertJsonPath('data.vehicle_number', 'GJ01BEARER1');
        $vehicleId = $created->json('data.id');

        $this->withToken($token)->withHeaders($headers)
            ->putJson("/api/v1/vehicles/{$vehicleId}", array_merge($payload, ['vehicle_number' => 'GJ01BEARER2']))
            ->assertOk()
            ->assertJsonPath('data.vehicle_number', 'GJ01BEARER2');

        $this->withToken($token)->withHeaders($headers)
            ->deleteJson("/api/v1/vehicles/{$vehicleId}")
            ->assertOk();

        $this->assertSoftDeleted('vehicles', ['id' => $vehicleId, 'tenant_id' => $user->tenant_id]);
    }

    public function test_vehicle_mutations_reject_requests_without_bearer_token(): void
    {
        $this->postJson('/api/v1/vehicles', [])->assertUnauthorized();
    }
}
