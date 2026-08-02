<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class DashboardSummaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_summary_returns_real_tenant_scoped_metrics(): void
    {
        $user = User::factory()->create(['is_admin' => true]);

        $this->actingAs($user)->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('data.kpis.customers.value', 0)
            ->assertJsonPath('data.kpis.monthly_revenue.value', 0)
            ->assertJsonPath('data.kpis.monthly_expenses.value', 0)
            ->assertJsonPath('data.kpis.net_result.value', 0)
            ->assertJsonStructure(['data' => ['kpis', 'revenue', 'policies', 'renewals', 'work']]);
    }

    public function test_policy_customer_pay_is_revenue_while_commission_drives_profit(): void
    {
        config(['app.timezone' => 'Asia/Kolkata']);
        $tenantA = (string) Str::uuid();
        $tenantB = (string) Str::uuid();
        $user = User::factory()->create(['tenant_id' => $tenantA, 'is_admin' => true]);
        $customerA = (string) Str::uuid();
        $customerB = (string) Str::uuid();
        $now = now();

        foreach ([[$customerA, $tenantA, 'A'], [$customerB, $tenantB, 'B']] as [$id, $tenant, $suffix]) {
            DB::table('customers')->insert(['id' => $id, 'tenant_id' => $tenant, 'customer_code' => "CUS-{$suffix}", 'first_name' => 'Tenant', 'last_name' => $suffix, 'mobile' => "900000000{$suffix}", 'created_at' => $now, 'updated_at' => $now]);
        }
        $vehicleA = (string) Str::uuid();
        $vehicleB = (string) Str::uuid();
        foreach ([[$vehicleA, $customerA, $tenantA, 'A'], [$vehicleB, $customerB, $tenantB, 'B']] as [$id, $customer, $tenant, $suffix]) {
            DB::table('vehicles')->insert(['id' => $id, 'tenant_id' => $tenant, 'customer_id' => $customer, 'vehicle_number' => "GJ01TEST{$suffix}", 'chassis_number' => "CHASSIS-{$suffix}", 'engine_number' => "ENGINE-{$suffix}", 'vehicle_type' => 'private_car', 'created_at' => $now, 'updated_at' => $now]);
        }
        $policyA = (string) Str::uuid();
        DB::table('vehicle_insurances')->insert([
            ['id' => $policyA, 'tenant_id' => $tenantA, 'vehicle_id' => $vehicleA, 'company_name' => 'Test Insurance', 'purchase_from' => 'direct_company', 'policy_number' => 'POLICY-A', 'issue_date' => $now->toDateString(), 'expiry_date' => $now->copy()->addYear()->toDateString(), 'status' => 'running', 'insurance_type' => 'comprehensive', 'gross_premium' => 4626.78, 'customer_pay' => 4626.78, 'gross_commission' => 1058.67, 'agent_commission' => 58.67, 'created_at' => $now, 'updated_at' => $now],
            ['id' => (string) Str::uuid(), 'tenant_id' => $tenantB, 'vehicle_id' => $vehicleB, 'company_name' => 'Other Insurance', 'purchase_from' => 'direct_company', 'policy_number' => 'POLICY-B', 'issue_date' => $now->toDateString(), 'expiry_date' => $now->copy()->addYear()->toDateString(), 'status' => 'running', 'insurance_type' => 'third_party', 'gross_premium' => 9999, 'customer_pay' => 9999, 'gross_commission' => 9999, 'agent_commission' => 0, 'created_at' => $now, 'updated_at' => $now],
        ]);
        DB::table('accounting_vouchers')->insert([
            ['id' => (string) Str::uuid(), 'tenant_id' => $tenantA, 'voucher_number' => 'REC-A', 'voucher_type' => 'receipt', 'voucher_date' => $now->toDateString(), 'total_debit' => 1200, 'total_credit' => 1200, 'status' => 'posted', 'created_at' => $now, 'updated_at' => $now],
            ['id' => (string) Str::uuid(), 'tenant_id' => $tenantA, 'voucher_number' => 'PAY-A', 'voucher_type' => 'payment', 'voucher_date' => $now->toDateString(), 'total_debit' => 200, 'total_credit' => 200, 'status' => 'posted', 'created_at' => $now, 'updated_at' => $now],
        ]);
        $companyId = (string) Str::uuid();
        DB::table('insurance_companies')->insert(['id' => $companyId, 'tenant_id' => $tenantA, 'company_name' => 'Dashboard Insurance', 'status' => 'active', 'created_at' => $now, 'updated_at' => $now]);
        DB::table('insurance_commissions')->insert(['id' => (string) Str::uuid(), 'tenant_id' => $tenantA, 'insurance_company_id' => $companyId, 'statement_date' => $now->toDateString(), 'gross_commission' => 1058.67, 'tds_percent' => 10, 'tds_amount' => 100, 'net_receivable' => 958.67, 'created_at' => $now, 'updated_at' => $now]);

        $this->actingAs($user)->getJson('/api/v1/dashboard/summary')->assertOk()
            ->assertJsonPath('data.kpis.customers.value', 1)
            ->assertJsonPath('data.kpis.payments_received.value', 1200)
            ->assertJsonPath('data.kpis.monthly_revenue.value', 1058.67)
            ->assertJsonPath('data.kpis.agent_commission.value', 58.67)
            ->assertJsonPath('data.kpis.tds.value', 100)
            ->assertJsonPath('data.kpis.monthly_expenses.value', 200)
            ->assertJsonPath('data.kpis.net_result.value', 700)
            ->assertJsonPath('data.period.key', 'today')
            ->assertJsonPath('data.period.timezone', 'Asia/Kolkata')
            ->assertJsonPath('data.kpis.revenue.value', 4626.78)
            ->assertJsonPath('data.revenue.current', 4626.78)
            ->assertJsonPath('data.revenue.gross_commission', 1058.67);

        DB::table('vehicle_insurances')->where('id', $policyA)->update(['gross_commission' => 1200, 'updated_at' => now()]);
        $this->actingAs($user)->getJson('/api/v1/dashboard/summary')->assertOk()
            ->assertJsonPath('data.kpis.monthly_revenue.value', 1200)
            ->assertJsonPath('data.kpis.net_result.value', 841.33);

        $this->actingAs($user)->getJson('/api/v1/dashboard/summary?period=custom&date_from='.$now->toDateString().'&date_to='.$now->toDateString())
            ->assertOk()->assertJsonPath('data.kpis.monthly_revenue.value', 1200);
        $this->actingAs($user)->getJson('/api/v1/dashboard/summary?period=this_year')
            ->assertOk()->assertJsonPath('data.period.key', 'this_year')->assertJsonPath('data.kpis.monthly_revenue.value', 1200);
        foreach (['today', 'yesterday', 'this_week', 'this_month', 'last_month', 'this_year', 'all_time'] as $period) {
            $response = $this->actingAs($user)->getJson('/api/v1/dashboard/summary?period='.$period)
                ->assertOk()->assertJsonPath('data.period.key', $period)
                ->assertJsonPath('data.period.timezone', 'Asia/Kolkata');
            if (in_array($period, ['today', 'this_week', 'this_month', 'this_year', 'all_time'], true)) {
                $response->assertJsonPath('data.kpis.revenue.value', 4626.78)
                    ->assertJsonPath('data.kpis.gross_commission.value', 1200);
            }
        }
        $this->actingAs($user)->getJson('/api/v1/dashboard/summary?period=this_month')
            ->assertJsonPath('data.kpis.revenue.value', 4626.78)->assertJsonPath('data.kpis.gross_commission.value', 1200);
        $this->actingAs($user)->getJson('/api/v1/dashboard/summary?period=all_time')
            ->assertJsonPath('data.kpis.revenue.value', 4626.78)->assertJsonPath('data.kpis.gross_commission.value', 1200);
        $this->actingAs($user)->getJson('/api/v1/dashboard/summary?period=custom&date_from='.$now->toDateString().'&date_to='.$now->toDateString())
            ->assertOk()->assertJsonPath('data.period.key', 'custom')->assertJsonPath('data.kpis.revenue.value', 4626.78)->assertJsonPath('data.kpis.gross_commission.value', 1200);
    }
}
