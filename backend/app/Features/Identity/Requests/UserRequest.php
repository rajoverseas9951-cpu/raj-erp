<?php
namespace App\Features\Identity\Requests;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
class UserRequest extends FormRequest { public function authorize():bool{return $this->user()?->can($this->isMethod('post')?'create': 'update', $this->route('user') ? \App\Models\User::find($this->route('user')) : \App\Models\User::class)??false;} public function rules():array{$id=$this->route('user');$tenant=$this->user()?->tenant_id;return ['name'=>['required','string','max:160'],'email'=>['required','email:rfc','max:255',Rule::unique('users')->where(fn($q)=>$q->where('tenant_id',$tenant))->ignore($id)],'password'=>[$this->isMethod('post')?'required':'nullable','string','min:12','confirmed'],'is_active'=>['sometimes','boolean'],'role_ids'=>['sometimes','array'],'role_ids.*'=>['uuid']];} }
