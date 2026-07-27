<?php
namespace App\Features\Identity\Requests;
use Illuminate\Foundation\Http\FormRequest;
class ResetPasswordRequest extends FormRequest { public function authorize():bool{return true;} public function rules():array{return ['tenant_id'=>['required','uuid'],'email'=>['required','email:rfc'],'token'=>['required','string'],'password'=>['required','string','min:12','confirmed']];} }
