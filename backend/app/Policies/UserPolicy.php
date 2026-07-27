<?php
namespace App\Policies;
use App\Models\User;
class UserPolicy { public function viewAny(User $actor):bool{return $actor->hasPermission('users.view');} public function view(User $actor,User $user):bool{return $actor->tenant_id===$user->tenant_id&&$actor->hasPermission('users.view');} public function create(User $actor):bool{return $actor->hasPermission('users.create');} public function update(User $actor,User $user):bool{return $actor->tenant_id===$user->tenant_id&&$actor->hasPermission('users.update');} public function delete(User $actor,User $user):bool{return $actor->id!==$user->id&&$actor->tenant_id===$user->tenant_id&&$actor->hasPermission('users.delete');} }
