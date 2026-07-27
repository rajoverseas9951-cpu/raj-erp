<?php
namespace App\Features\Identity\Requests;
use Illuminate\Foundation\Http\FormRequest;
class LoginRequest extends FormRequest { public function authorize(): bool{return true;} public function rules():array{return ['tenant_id'=>['required','uuid'],'email'=>['required','email:rfc','max:255'],'password'=>['required','string','max:255'],'device_name'=>['nullable','string','max:100']];} }
