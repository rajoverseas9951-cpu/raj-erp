<?php
namespace App\Features\Identity\Repositories;
use App\Models\Role;
use Illuminate\Support\Collection;
class RoleRepository { public function all(string $tenantId): Collection { return Role::with('permissions')->where('tenant_id',$tenantId)->orderBy('name')->get(); } public function find(string $id,string $tenantId): Role { return Role::where('tenant_id',$tenantId)->findOrFail($id); } }
