<?php
namespace Tests\Unit;
use App\Models\Permission; use App\Models\Role; use App\Models\User; use Illuminate\Foundation\Testing\RefreshDatabase; use Tests\TestCase;
class UserPermissionTest extends TestCase { use RefreshDatabase; public function test_role_grants_permission_only_to_assigned_user():void{$tenant='00000000-0000-4000-8000-000000000001';$permission=Permission::create(['name'=>'users.view']);$role=Role::create(['tenant_id'=>$tenant,'name'=>'Reader','slug'=>'reader']);$role->permissions()->attach($permission);$allowed=User::factory()->create(['tenant_id'=>$tenant]);$denied=User::factory()->create(['tenant_id'=>$tenant]);$allowed->roles()->attach($role);$this->assertTrue($allowed->hasPermission('users.view'));$this->assertFalse($denied->hasPermission('users.view'));} }
