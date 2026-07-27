<?php
namespace Tests\Feature;
use App\Models\User; use Illuminate\Foundation\Testing\RefreshDatabase; use Tests\TestCase;
class AuthenticationTest extends TestCase { use RefreshDatabase; public function test_admin_can_obtain_a_sanctum_token(): void { User::factory()->create(['tenant_id'=>'00000000-0000-4000-8000-000000000001','email'=>'admin@example.com','password'=>'password','is_admin'=>true]); $this->postJson('/api/v1/auth/login',['tenant_id'=>'00000000-0000-4000-8000-000000000001','email'=>'admin@example.com','password'=>'password'])->assertOk()->assertJsonStructure(['data'=>['user','token']]); } public function test_business_routes_require_authentication(): void { $this->getJson('/api/v1/customers')->assertUnauthorized(); $this->getJson('/api/v1/vehicles')->assertUnauthorized(); } }
