<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\OrganizationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrganizationIdentityTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_only_read_their_organization(): void
    {
        $tenant = Tenant::create(['name' => 'Raj Insurance Consultancy', 'brand_name' => 'Vimawallah', 'tagline' => 'Your Safety, Our Responsibility', 'email' => 'vimawallah9951@gmail.com']);
        Tenant::create(['name' => 'Another Organization']);
        $user = User::factory()->create(['tenant_id' => $tenant->id, 'is_admin' => true]);

        $this->actingAs($user)->getJson('/api/v1/organization')
            ->assertOk()
            ->assertJsonPath('data.id', $tenant->id)
            ->assertJsonPath('data.name', 'Raj Insurance Consultancy')
            ->assertJsonMissing(['name' => 'Another Organization']);
    }

    public function test_organization_seeder_is_idempotent_and_preserves_tenant_id(): void
    {
        $this->seed(OrganizationSeeder::class);
        $this->seed(OrganizationSeeder::class);

        $this->assertDatabaseCount('tenants', 1);
        $this->assertDatabaseHas('tenants', [
            'id' => '00000000-0000-4000-8000-000000000001',
            'name' => 'Raj Insurance Consultancy',
            'brand_name' => 'Vimawallah',
            'email' => 'vimawallah9951@gmail.com',
        ]);
    }
}
