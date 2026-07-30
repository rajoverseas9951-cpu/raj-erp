<?php

namespace Tests\Feature;

use App\Features\Customers\Models\Customer;
use App\Features\Vehicles\Models\Vehicle;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VehicleInsurancePolicyTest extends TestCase
{
    use RefreshDatabase;

    public function test_policy_create_and_update_calculate_amounts_without_tds_fields(): void
    {
        [$user, $vehicle] = $this->userAndVehicle();
        $payload = $this->payload();

        $created = $this->actingAs($user)->postJson("/api/v1/vehicles/{$vehicle->id}/insurances", $payload);

        $created->assertCreated()
            ->assertJsonPath('data.gross_premium', '650.00')
            ->assertJsonPath('data.gross_commission', '65.00')
            ->assertJsonPath('data.customer_pay', '625.00')
            ->assertJsonMissingPath('data.tds_percent')
            ->assertJsonMissingPath('data.tds_amount')
            ->assertJsonMissingPath('data.net_commission');

        $policyId = $created->json('data.id');
        $updated = $this->actingAs($user)->putJson(
            "/api/v1/vehicles/{$vehicle->id}/insurances/{$policyId}",
            array_merge($payload, [
                'od_premium' => 200,
                'commission_percent' => 15,
                'agent_commission' => 80,
            ])
        );

        $updated->assertOk()
            ->assertJsonPath('data.gross_premium', '750.00')
            ->assertJsonPath('data.gross_commission', '112.50')
            ->assertJsonPath('data.customer_pay', '725.00')
            ->assertJsonPath('data.agent_commission', '80.00');

        $this->actingAs($user)
            ->getJson("/api/v1/vehicles/{$vehicle->id}/insurances")
            ->assertOk()
            ->assertJsonPath('data.0.id', $policyId);
    }

    public function test_policy_rejects_tds_fields_and_agent_commission_above_gross_commission(): void
    {
        [$user, $vehicle] = $this->userAndVehicle();

        $this->actingAs($user)
            ->postJson("/api/v1/vehicles/{$vehicle->id}/insurances", array_merge($this->payload(), [
                'tds_percent' => 10,
                'tds_amount' => 6.50,
                'net_commission' => 58.50,
            ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['tds_percent', 'tds_amount', 'net_commission']);

        $this->actingAs($user)
            ->postJson("/api/v1/vehicles/{$vehicle->id}/insurances", array_merge($this->payload(), [
                'agent_commission' => 65.01,
            ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['agent_commission']);
    }

    private function payload(): array
    {
        return [
            'company_name' => 'TEST INSURANCE',
            'company_code' => 'TI',
            'purchase_from' => 'DIRECT',
            'policy_number' => 'POL-1001',
            'policy_date' => '2026-07-01',
            'issue_date' => '2026-07-01',
            'expiry_date' => '2027-06-30',
            'status' => 'running',
            'insurance_type' => 'comprehensive',
            'remark' => 'API policy test',
            'od_premium' => 100,
            'tp_premium' => 200,
            'addon_premium' => 300,
            'gst_other_charges' => 50,
            'commission_percent' => 10,
            'customer_discount' => 25,
            'agent' => 'Test Agent',
            'agent_commission' => 60,
            'payment_details' => ['mode' => 'cash'],
        ];
    }

    private function userAndVehicle(): array
    {
        $user = User::factory()->create(['is_admin' => true]);
        $customer = Customer::create([
            'tenant_id' => $user->tenant_id,
            'customer_code' => 'CUS-TEST',
            'first_name' => 'Test',
            'last_name' => 'Customer',
            'mobile' => '9999999999',
        ]);
        $vehicle = Vehicle::create([
            'tenant_id' => $user->tenant_id,
            'customer_id' => $customer->id,
            'vehicle_number' => 'GJ01AB1234',
            'chassis_number' => 'MA3TESTCHASSIS1234',
            'engine_number' => 'ENGTEST1234',
            'insurance_status' => 'not_added',
            'fitness_status' => 'not_added',
            'permit_status' => 'not_added',
            'tax_status' => 'not_added',
            'puc_status' => 'not_added',
        ]);

        return [$user, $vehicle];
    }
}
