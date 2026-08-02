<?php

namespace Tests\Feature;

use App\Features\Customers\Models\Customer;
use App\Features\Vehicles\Models\Vehicle;
use App\Features\Vehicles\Models\VehicleInsurance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class VehiclePolicyLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_vehicle_with_policy_is_blocked_but_empty_vehicle_can_be_permanently_deleted(): void
    {
        [$user, $vehicle] = $this->vehicle();
        $policy = $this->policy($vehicle, 'running');
        $this->actingAs($user)->deleteJson("/api/v1/vehicles/{$vehicle->id}")
            ->assertStatus(409)->assertJsonPath('dependency_counts.policies', 1);
        $this->assertDatabaseHas('vehicle_insurances', ['id' => $policy->id]);

        [, $empty] = $this->vehicle($user);
        $this->actingAs($user)->deleteJson("/api/v1/vehicles/{$empty->id}")->assertOk();
        $this->assertDatabaseMissing('vehicles', ['id' => $empty->id]);
    }

    public function test_archive_removes_vehicle_from_active_list_and_dashboard_count(): void
    {
        [$user, $vehicle] = $this->vehicle();
        $this->actingAs($user)->postJson("/api/v1/vehicles/{$vehicle->id}/archive")->assertOk();
        $this->actingAs($user)->getJson('/api/v1/vehicles')->assertOk()->assertJsonPath('data.total', 0);
        $this->actingAs($user)->getJson('/api/v1/dashboard/summary?period=all_time')->assertOk()->assertJsonPath('data.kpis.vehicles.value', 0);
        $this->assertDatabaseHas('vehicles', ['id' => $vehicle->id]);
    }

    public function test_draft_policy_without_dependencies_can_be_deleted_and_history_refreshes(): void
    {
        [$user, $vehicle] = $this->vehicle();
        $policy = $this->policy($vehicle, 'draft');
        $this->actingAs($user)->deleteJson("/api/v1/vehicles/{$vehicle->id}/insurances/{$policy->id}")->assertOk();
        $this->assertDatabaseMissing('vehicle_insurances', ['id' => $policy->id]);
        $this->actingAs($user)->getJson("/api/v1/vehicles/{$vehicle->id}/insurances")->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_posted_policy_cannot_be_deleted_but_can_be_cancelled_and_is_excluded_from_dashboard(): void
    {
        [$user, $vehicle] = $this->vehicle();
        $policy = $this->policy($vehicle, 'running');
        DB::table('insurance_companies')->insert(['id' => $company = (string) Str::uuid(), 'tenant_id' => $user->tenant_id, 'company_name' => 'Lifecycle Insurance', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('insurance_commissions')->insert(['id' => $commission = (string) Str::uuid(), 'tenant_id' => $user->tenant_id, 'insurance_company_id' => $company, 'policy_id' => $policy->id, 'statement_date' => now()->toDateString(), 'gross_commission' => 1000, 'tds_amount' => 100, 'net_receivable' => 900, 'received_amount' => 500, 'status' => 'partial', 'created_at' => now(), 'updated_at' => now()]);
        $this->actingAs($user)->deleteJson("/api/v1/vehicles/{$vehicle->id}/insurances/{$policy->id}")
            ->assertStatus(409)->assertJsonPath('dependency_counts.financial_entries', 1);
        $this->actingAs($user)->getJson('/api/v1/dashboard/summary?period=today')->assertOk()
            ->assertJsonPath('data.kpis.revenue.value', 4626.78)->assertJsonPath('data.kpis.gross_commission.value', 1058.67);

        $this->actingAs($user)->postJson("/api/v1/vehicles/{$vehicle->id}/insurances/{$policy->id}/cancel", [
            'cancellation_date' => now()->toDateString(), 'cancellation_reason' => 'Customer requested cancellation',
            'refund_amount' => 100, 'cancellation_charges' => 25, 'confirmed' => true,
        ])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertDatabaseHas('insurance_commission_reversals', ['policy_id' => $policy->id, 'commission_id' => $commission]);
        $this->assertDatabaseHas('insurance_commissions', ['id' => $commission, 'status' => 'cancelled']);
        $this->actingAs($user)->getJson('/api/v1/dashboard/summary?period=today')->assertOk()
            ->assertJsonPath('data.kpis.revenue.value', 0)->assertJsonPath('data.kpis.gross_commission.value', 0)
            ->assertJsonPath('data.kpis.policies.value', 0);
    }

    public function test_policy_mutations_are_tenant_scoped(): void
    {
        [$owner, $vehicle] = $this->vehicle(); $policy = $this->policy($vehicle, 'draft');
        $other = User::factory()->create(['tenant_id' => (string) Str::uuid(), 'is_admin' => true]);
        $this->actingAs($other)->deleteJson("/api/v1/vehicles/{$vehicle->id}/insurances/{$policy->id}")->assertNotFound();
        $this->assertDatabaseHas('vehicle_insurances', ['id' => $policy->id, 'tenant_id' => $owner->tenant_id]);
    }

    public function test_integrity_repair_cancels_orphaned_policy_and_records_commission_reversal_once(): void
    {
        [$user, $vehicle] = $this->vehicle();
        $policy = $this->policy($vehicle, 'running');
        DB::table('insurance_companies')->insert(['id' => $company = (string) Str::uuid(), 'tenant_id' => $user->tenant_id, 'company_name' => 'Repair Insurance', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('insurance_commissions')->insert([
            'id' => $commission = (string) Str::uuid(), 'tenant_id' => $user->tenant_id, 'insurance_company_id' => $company,
            'policy_id' => $policy->id, 'statement_date' => now()->toDateString(), 'gross_commission' => 392.70,
            'tds_amount' => 19.64, 'net_receivable' => 373.06, 'received_amount' => 0, 'status' => 'pending',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $vehicle->delete();

        Artisan::call('data:repair-integrity', ['--dry-run' => true]);
        $this->assertStringContainsString($policy->id, Artisan::output());
        $this->assertStringContainsString($commission, Artisan::output());
        $this->assertDatabaseHas('vehicle_insurances', ['id' => $policy->id, 'status' => 'running']);
        $this->assertDatabaseMissing('insurance_commission_reversals', ['policy_id' => $policy->id]);

        Artisan::call('data:repair-integrity', ['--apply' => true]);
        $this->assertDatabaseHas('vehicle_insurances', ['id' => $policy->id, 'status' => 'cancelled']);
        $this->assertNotNull(DB::table('vehicle_insurances')->where('id', $policy->id)->value('archived_at'));
        $this->assertNotNull(DB::table('vehicle_insurances')->where('id', $policy->id)->value('cancelled_at'));
        $this->assertDatabaseHas('insurance_commissions', ['id' => $commission, 'status' => 'cancelled']);
        $this->assertDatabaseHas('insurance_commission_reversals', [
            'policy_id' => $policy->id, 'commission_id' => $commission,
            'gross_commission' => -392.70, 'tds_amount' => -19.64, 'net_receivable' => -373.06,
        ]);

        Artisan::call('data:repair-integrity', ['--apply' => true]);
        $this->assertSame(1, DB::table('insurance_commission_reversals')->where('policy_id', $policy->id)->count());
        $this->assertStringNotContainsString($policy->id, Artisan::output());
    }

    private function vehicle(?User $user = null): array
    {
        $user ??= User::factory()->create(['is_admin' => true]);
        $customer = Customer::create(['tenant_id' => $user->tenant_id, 'customer_code' => 'CUS-'.Str::random(8), 'first_name' => 'Lifecycle', 'last_name' => 'Owner', 'mobile' => '9'.random_int(100000000, 999999999)]);
        $vehicle = Vehicle::create(['tenant_id' => $user->tenant_id, 'customer_id' => $customer->id, 'vehicle_number' => 'GJ'.Str::upper(Str::random(8)), 'chassis_number' => Str::random(20), 'engine_number' => Str::random(20), 'vehicle_type' => 'private_car', 'insurance_status' => 'not_added', 'fitness_status' => 'not_added', 'permit_status' => 'not_added', 'tax_status' => 'not_added', 'puc_status' => 'not_added']);
        return [$user, $vehicle];
    }

    private function policy(Vehicle $vehicle, string $status): VehicleInsurance
    {
        return VehicleInsurance::create(['tenant_id' => $vehicle->tenant_id, 'vehicle_id' => $vehicle->id, 'company_name' => 'Test Insurance', 'purchase_from' => 'Direct', 'policy_number' => 'POL-'.Str::upper(Str::random(8)), 'issue_date' => now(), 'expiry_date' => now()->addYear(), 'status' => $status, 'insurance_type' => 'comprehensive', 'gross_premium' => 4626.78, 'customer_pay' => 4626.78, 'gross_commission' => 1058.67, 'agent_commission' => 58.67]);
    }
}
