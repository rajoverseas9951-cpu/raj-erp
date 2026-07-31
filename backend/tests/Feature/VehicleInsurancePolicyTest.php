<?php

namespace Tests\Feature;

use App\Features\Customers\Models\Customer;
use App\Features\Vehicles\Models\Vehicle;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
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

    #[DataProvider('automaticGstCases')]
    public function test_private_car_and_two_wheeler_premiums_use_automatic_eighteen_percent_gst(
        string $vehicleType,
        bool $hasOd,
        bool $hasTp,
        float $od,
        float $tp,
        float $addon,
        float $discount,
        string $net,
        string $gst,
        string $gross,
        string $pay,
    ): void {
        [$user, $vehicle] = $this->userAndVehicle($vehicleType);
        $payload = array_merge($this->payload(), [
            'policy_number' => 'GST-'.strtoupper($vehicleType).'-'.uniqid(),
            'has_od_cover' => $hasOd,
            'has_tp_cover' => $hasTp,
            'od_premium' => $od,
            'tp_premium' => $tp,
            'addon_premium' => $addon,
            'other_charges' => 0,
            'customer_discount' => $discount,
            'agent_commission' => 0,
            'commission_on_od' => false,
            'commission_on_tp' => false,
            'commission_on_net' => false,
        ]);

        $this->actingAs($user)
            ->postJson("/api/v1/vehicles/{$vehicle->id}/insurances", $payload)
            ->assertCreated()
            ->assertJsonPath('data.od_premium', $hasOd ? number_format($od, 2, '.', '') : '0.00')
            ->assertJsonPath('data.tp_premium', $hasTp ? number_format($tp, 2, '.', '') : '0.00')
            ->assertJsonPath('data.net_premium', $net)
            ->assertJsonPath('data.gst_percent', '18.00')
            ->assertJsonPath('data.gst_amount', $gst)
            ->assertJsonPath('data.gross_premium', $gross)
            ->assertJsonPath('data.customer_pay', $pay);
    }

    public static function automaticGstCases(): array
    {
        return [
            'private car OD only' => ['private_car', true, false, 10000, 3000, 0, 0, '10000.00', '1800.00', '11800.00', '11800.00'],
            'private car TP only' => ['private_car', false, true, 10000, 3000, 0, 0, '3000.00', '540.00', '3540.00', '3540.00'],
            'private car package' => ['private_car', true, true, 10000, 3000, 0, 0, '13000.00', '2340.00', '15340.00', '15340.00'],
            'private car package add-on' => ['private_car', true, true, 10000, 3000, 2000, 0, '15000.00', '2700.00', '17700.00', '17700.00'],
            'private car discount' => ['private_car', true, true, 10000, 3000, 2000, 700, '15000.00', '2700.00', '17700.00', '17000.00'],
            'two wheeler OD only' => ['two_wheeler', true, false, 1000, 300, 0, 0, '1000.00', '180.00', '1180.00', '1180.00'],
            'two wheeler TP only' => ['two_wheeler', false, true, 1000, 300, 0, 0, '300.00', '54.00', '354.00', '354.00'],
            'two wheeler package' => ['two_wheeler', true, true, 1000, 300, 0, 0, '1300.00', '234.00', '1534.00', '1534.00'],
            'two wheeler package add-on' => ['two_wheeler', true, true, 1000, 300, 200, 0, '1500.00', '270.00', '1770.00', '1770.00'],
        ];
    }

    public function test_private_car_commission_basis_and_receivable_sources_are_saved(): void
    {
        [$user, $vehicle] = $this->userAndVehicle('private_car');
        $companyId = (string) Str::uuid();
        DB::table('insurance_companies')->insert([
            'id'=>$companyId,'tenant_id'=>$user->tenant_id,'company_name'=>'TATA AIG',
            'short_code'=>'TATA','agency_code_name'=>'JAKIR A MEMON','default_commission_percent'=>0,
            'tds_percent'=>5,'settlement_days'=>30,'status'=>'active','created_at'=>now(),'updated_at'=>now(),
        ]);
        $sourceId = (string) Str::uuid();
        DB::table('insurance_purchase_sources')->insert([
            'id'=>$sourceId,'tenant_id'=>$user->tenant_id,'name'=>'EXTERNAL BROKER',
            'source_type'=>'insurance_broker','tds_applicable'=>false,'tds_percent'=>0,
            'is_active'=>true,'created_at'=>now(),'updated_at'=>now(),
        ]);

        $base = array_merge($this->payload(), [
            'insurance_company_id'=>$companyId,'has_od_cover'=>true,'has_tp_cover'=>true,
            'od_premium'=>10000,'tp_premium'=>3000,'addon_premium'=>0,'customer_discount'=>0,
            'agent_commission'=>0,'commission_on_tp'=>false,
        ]);
        $package = $this->actingAs($user)->postJson("/api/v1/vehicles/{$vehicle->id}/insurances", array_merge($base, [
            'policy_number'=>'PRIVATE-PACKAGE','purchase_from_type'=>'direct_company',
            'commission_basis'=>'od_premium','od_commission_percent'=>15,
        ]))->assertCreated()
            ->assertJsonPath('data.gross_commission','1500.00')
            ->assertJsonPath('data.commission_receivable_from_type','insurance_company')
            ->assertJsonPath('data.commission_receivable_from_id',$companyId);

        $this->actingAs($user)->putJson(
            "/api/v1/vehicles/{$vehicle->id}/insurances/{$package->json('data.id')}",
            array_merge($base, [
                'policy_number'=>'PRIVATE-PACKAGE','purchase_from_type'=>'agent','purchase_source_id'=>$sourceId,
                'commission_basis'=>'manual','gross_commission'=>777,
            ])
        )->assertOk()
            ->assertJsonPath('data.gross_commission','777.00')
            ->assertJsonPath('data.commission_receivable_from_type','purchase_source')
            ->assertJsonPath('data.commission_receivable_from_id',$sourceId);

        $this->actingAs($user)->postJson("/api/v1/vehicles/{$vehicle->id}/insurances", array_merge($base, [
            'policy_number'=>'PRIVATE-TP','insurance_type'=>'third_party','has_od_cover'=>false,
            'purchase_from_type'=>'direct_company','commission_basis'=>'net_premium','commission_percent'=>2.5,
        ]))->assertCreated()
            ->assertJsonPath('data.od_premium','0.00')
            ->assertJsonPath('data.gross_commission','75.00');
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

    private function userAndVehicle(?string $vehicleType = null): array
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
            'vehicle_type' => $vehicleType,
            'insurance_status' => 'not_added',
            'fitness_status' => 'not_added',
            'permit_status' => 'not_added',
            'tax_status' => 'not_added',
            'puc_status' => 'not_added',
        ]);

        return [$user, $vehicle];
    }
}
