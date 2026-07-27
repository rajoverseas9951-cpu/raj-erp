<?php
namespace App\Features\Identity\Resources;
use Illuminate\Http\Request; use Illuminate\Http\Resources\Json\JsonResource;
class UserResource extends JsonResource { public function toArray(Request $request):array{return ['id'=>$this->id,'tenant_id'=>$this->tenant_id,'name'=>$this->name,'email'=>$this->email,'is_active'=>$this->is_active,'roles'=>$this->whenLoaded('roles',fn()=>RoleResource::collection($this->roles)),'created_at'=>$this->created_at?->toISOString(),'updated_at'=>$this->updated_at?->toISOString()];} }
