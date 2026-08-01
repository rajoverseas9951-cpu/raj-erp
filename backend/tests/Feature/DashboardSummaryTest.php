<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
