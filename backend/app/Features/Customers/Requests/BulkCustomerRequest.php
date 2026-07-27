<?php
namespace App\Features\Customers\Requests;
use Illuminate\Foundation\Http\FormRequest;
class BulkCustomerRequest extends FormRequest { public function authorize(): bool { return $this->user()?->can('customer.bulk') ?? false; } public function rules(): array { return ['ids'=>['required','array','min:1'],'ids.*'=>['uuid'],'assigned_to'=>['sometimes','required','uuid']]; } }
