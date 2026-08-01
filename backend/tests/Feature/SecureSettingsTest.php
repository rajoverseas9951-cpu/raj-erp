<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SecureSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_password_change_requires_current_password_and_strong_confirmation(): void
    {
        $user = User::factory()->create(['password' => 'OldPassword!1']);

        $this->actingAs($user)->putJson('/api/v1/auth/password', [
            'current_password' => 'wrong', 'password' => 'weak', 'password_confirmation' => 'weak',
        ])->assertUnprocessable()->assertJsonValidationErrors(['current_password', 'password']);
    }

    public function test_password_change_hashes_the_new_password(): void
    {
        $user = User::factory()->create(['password' => 'OldPassword!1']);
        $this->actingAs($user)->putJson('/api/v1/auth/password', [
            'current_password' => 'OldPassword!1', 'password' => 'NewPassword!2', 'password_confirmation' => 'NewPassword!2',
        ])->assertOk();
        $this->assertTrue(Hash::check('NewPassword!2', $user->fresh()->password));
    }

    public function test_profile_update_cannot_change_tenant_or_role(): void
    {
        $tenant = Tenant::create(['name' => 'Vimawallah']);
        $user = User::factory()->create(['tenant_id' => $tenant->id, 'is_admin' => true]);
        $this->actingAs($user)->postJson('/api/v1/profile', [
            'name' => 'Production Admin', 'email' => 'vimawallah9951@gmail.com',
            'tenant_id' => '11111111-1111-4111-8111-111111111111', 'is_admin' => false,
        ])->assertOk();
        $user->refresh();
        $this->assertSame($tenant->id, $user->tenant_id);
        $this->assertTrue($user->is_admin);
    }
}
