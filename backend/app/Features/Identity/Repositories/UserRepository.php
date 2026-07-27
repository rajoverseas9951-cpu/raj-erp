<?php
namespace App\Features\Identity\Repositories;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
class UserRepository {
 public function paginate(string $tenantId,array $filters): LengthAwarePaginator { return User::with('roles.permissions')->where('tenant_id',$tenantId)->when($filters['search']??null,fn($q,$s)=>$q->where(fn($w)=>$w->where('name','like',"%$s%")->orWhere('email','like',"%$s%")))->latest()->paginate(min((int)($filters['per_page']??25),100)); }
 public function find(string $id,string $tenantId): User { return User::with('roles.permissions')->where('tenant_id',$tenantId)->findOrFail($id); }
 public function findForLogin(string $email,string $tenantId): ?User { return User::where('tenant_id',$tenantId)->where('email',strtolower($email))->first(); }
 public function create(array $data): User { return User::create($data); }
 public function update(User $user,array $data): User { $user->update($data); return $user->refresh()->load('roles.permissions'); }
 public function delete(User $user): void { $user->tokens()->delete(); $user->delete(); }
}
