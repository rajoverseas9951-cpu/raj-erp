<?php
namespace App\Features\Identity\Services;
use App\Features\Identity\Repositories\RoleRepository;
use App\Features\Identity\Repositories\UserRepository;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
class UserService { public function __construct(private UserRepository $users,private RoleRepository $roles,private AuditService $audit) {} private function clean(array $data): array { $result=Arr::except($data,['role_ids']); if(empty($result['password'])) unset($result['password']); if(isset($result['email'])) $result['email']=strtolower($result['email']); return $result; }
 public function create(array $data,User $actor,Request $request): User { return DB::transaction(function() use($data,$actor,$request){ $user=$this->users->create($this->clean($data)+['tenant_id'=>$actor->tenant_id]); $this->syncRoles($user,$data['role_ids']??[],$actor->tenant_id); $user->load('roles.permissions'); $this->audit->record('user.created',$user,$actor,$request,null,$user->toArray()); return $user; }); }
 public function update(User $user,array $data,User $actor,Request $request): User { return DB::transaction(function() use($user,$data,$actor,$request){ $before=$user->load('roles')->toArray(); $user=$this->users->update($user,$this->clean($data)); if(array_key_exists('role_ids',$data)) $this->syncRoles($user,$data['role_ids'],$actor->tenant_id); $user->load('roles.permissions'); $this->audit->record('user.updated',$user,$actor,$request,$before,$user->toArray()); return $user; }); }
 public function delete(User $user,User $actor,Request $request): void { DB::transaction(function() use($user,$actor,$request){ $this->audit->record('user.deleted',$user,$actor,$request,$user->toArray()); $this->users->delete($user); }); }
 private function syncRoles(User $user,array $ids,string $tenantId): void { $valid=collect($ids)->map(fn($id)=>$this->roles->find($id,$tenantId)->id); $user->roles()->sync($valid); }
}
