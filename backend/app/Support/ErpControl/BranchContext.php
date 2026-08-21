<?php
namespace App\Support\ErpControl;
use App\Models\Branch; use App\Models\User; use Illuminate\Database\Eloquent\Builder; use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
class BranchContext {
    public function resolve(User $user, ?string $code): ?Branch { if(!$code)return null; $branch=Branch::query()->where('tenant_id',$user->tenant_id)->where('code',$code)->where('is_active',true)->first(); if(!$branch||!$this->canAccess($user,$branch))throw new AccessDeniedHttpException('Branch access denied.'); return $branch; }
    public function canAccess(User $user, Branch $branch):bool { return (string)$branch->tenant_id===(string)$user->tenant_id && ($user->has_tenant_wide_branch_access||$user->branches()->whereKey($branch->id)->exists()); }
    public function scope(Builder $query, User $user, ?Branch $branch):Builder { $query->where($query->qualifyColumn('tenant_id'),$user->tenant_id); if($branch)$query->where($query->qualifyColumn('branch_id'),$branch->id); elseif(!$user->has_tenant_wide_branch_access)throw new AccessDeniedHttpException('A branch context is required.'); return $query; }
}
