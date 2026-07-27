<?php
namespace App\Features\Identity\Services;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
class AuditService { public function record(string $action,?User $subject,?User $actor,Request $request,?array $before=null,?array $after=null): AuditLog { return AuditLog::create(['tenant_id'=>$actor?->tenant_id ?? $subject?->tenant_id,'actor_id'=>$actor?->id,'action'=>$action,'auditable_type'=>$subject ? User::class : 'authentication','auditable_id'=>$subject?->id,'before'=>$before,'after'=>$after,'ip_address'=>$request->ip(),'user_agent'=>$request->userAgent()]); } }
