<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InsuranceMasterTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_and_purchase_source_use_shared_master_apis(): void
    {
        $user = User::factory()->create(['is_admin' => true]);

        $company = $this->actingAs($user)->postJson('/api/v1/insurance-accounting/companies', [
            'company_name' => 'Tata AIG General Insurance',
            'short_code' => 'TATA AIG',
            'agency_code_name' => 'JAKIR A MEMON',
            'default_commission_percent' => 0,
            'tds_percent' => 5,
            'settlement_days' => 30,
            'contact_person' => 'Test Contact',
            'mobile' => '9999999999',
            'email' => 'insurance@example.test',
            'notes' => 'Shared company master test',
        ])->assertCreated()
            ->assertJsonPath('data.agency_code_name', 'JAKIR A MEMON')
            ->assertJsonPath('data.tds_percent', 5);

        $companyId = $company->json('data.id');
        $this->actingAs($user)->getJson('/api/v1/insurance-accounting/companies?search=TATA')
            ->assertOk()->assertJsonPath('data.0.id', $companyId);

        $source = $this->actingAs($user)->postJson('/api/v1/insurance-accounting/purchase-sources', [
            'name' => 'External Broker',
            'source_type' => 'insurance_broker',
            'mobile' => '8888888888',
            'linked_company_id' => $companyId,
            'tds_applicable' => false,
            'tds_percent' => 8,
            'is_active' => true,
            'notes' => 'Shared purchase source test',
        ])->assertCreated()
            ->assertJsonPath('data.tds_applicable', 0)
            ->assertJsonPath('data.tds_percent', 0);

        $sourceId = $source->json('data.id');
        $this->actingAs($user)->getJson('/api/v1/insurance-accounting/purchase-sources?search=External')
            ->assertOk()->assertJsonPath('data.0.id', $sourceId);

        $this->actingAs($user)->putJson("/api/v1/insurance-accounting/purchase-sources/{$sourceId}", [
            'name' => 'External Broker',
            'source_type' => 'insurance_broker',
            'linked_company_id' => $companyId,
            'tds_applicable' => false,
            'tds_percent' => 0,
            'is_active' => false,
        ])->assertOk()->assertJsonPath('data.is_active', 0);
        $this->actingAs($user)->getJson('/api/v1/insurance-accounting/companies?paginate=1&per_page=5&search=TATA')
            ->assertOk()->assertJsonPath('data.total', 1)->assertJsonPath('data.data.0.id', $companyId);
        $this->actingAs($user)->deleteJson("/api/v1/insurance-accounting/purchase-sources/{$sourceId}")->assertOk();
        $this->actingAs($user)->deleteJson("/api/v1/insurance-accounting/companies/{$companyId}")->assertOk();
        $this->actingAs($user)->getJson('/api/v1/insurance-accounting/companies')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_purchase_source_cannot_link_to_another_tenants_company(): void
    {
        $user = User::factory()->create(['is_admin' => true]);
        $other = User::factory()->create(['is_admin' => true]);
        $companyId = $this->actingAs($other)->postJson('/api/v1/insurance-accounting/companies', [
            'company_name' => 'Other Tenant Insurance', 'default_commission_percent' => 0, 'tds_percent' => 0, 'settlement_days' => 30,
        ])->assertCreated()->json('data.id');

        $this->actingAs($user)->postJson('/api/v1/insurance-accounting/purchase-sources', [
            'name' => 'Invalid Cross Tenant Source', 'source_type' => 'agency', 'linked_company_id' => $companyId,
        ])->assertUnprocessable()->assertJsonValidationErrors(['linked_company_id']);
    }
}
