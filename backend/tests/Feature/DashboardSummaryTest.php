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

    public function test_dashboard_values_are_fresh_and_tenant_scoped_after_create_and_delete(): void
    {
        $tenantA = (string) Str::uuid();
        $tenantB = (string) Str::uuid();
        $user = User::factory()->create(['tenant_id' => $tenantA, 'is_admin' => true]);
        $customerA = (string) Str::uuid();
        $customerB = (string) Str::uuid();
        $now = now();

        foreach ([[$customerA, $tenantA, 'A'], [$customerB, $tenantB, 'B']] as [$id, $tenant, $suffix]) {
            DB::table('customers')->insert(['id' => $id, 'tenant_id' => $tenant, 'customer_code' => "CUS-{$suffix}", 'first_name' => 'Tenant', 'last_name' => $suffix, 'mobile' => "900000000{$suffix}", 'created_at' => $now, 'updated_at' => $now]);
        }
        foreach ([[$tenantA, 'A', 1200, 200], [$tenantB, 'B', 9999, 8888]] as [$tenant, $suffix, $receipt, $payment]) {
            DB::table('accounting_vouchers')->insert([
                ['id' => (string) Str::uuid(), 'tenant_id' => $tenant, 'voucher_number' => "REC-{$suffix}", 'voucher_type' => 'receipt', 'voucher_date' => $now->toDateString(), 'total_debit' => $receipt, 'total_credit' => $receipt, 'status' => 'posted', 'created_at' => $now, 'updated_at' => $now],
                ['id' => (string) Str::uuid(), 'tenant_id' => $tenant, 'voucher_number' => "PAY-{$suffix}", 'voucher_type' => 'payment', 'voucher_date' => $now->toDateString(), 'total_debit' => $payment, 'total_credit' => $payment, 'status' => 'posted', 'created_at' => $now, 'updated_at' => $now],
            ]);
        }

        $this->actingAs($user)->getJson('/api/v1/dashboard/summary')->assertOk()
            ->assertJsonPath('data.kpis.customers.value', 1)
            ->assertJsonPath('data.kpis.payments_received.value', 1200)
            ->assertJsonPath('data.kpis.monthly_expenses.value', 200)
            ->assertJsonPath('data.kpis.net_result.value', 1000);

        DB::table('customers')->where('id', $customerA)->update(['deleted_at' => now()]);
        $this->actingAs($user)->getJson('/api/v1/dashboard/summary')->assertOk()
            ->assertJsonPath('data.kpis.customers.value', 0);
    }
}
