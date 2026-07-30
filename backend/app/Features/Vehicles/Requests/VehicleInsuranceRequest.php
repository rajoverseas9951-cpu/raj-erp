<?php

namespace App\Features\Vehicles\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class VehicleInsuranceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can($this->isMethod('post') ? 'vehicle.create' : 'vehicle.update') ?? false;
    }

    public function rules(): array
    {
        return [
            'insurance_company_id' => ['nullable', 'uuid'],
            'company_name' => ['required', 'string', 'max:200'],
            'company_code' => ['nullable', 'string', 'max:30'],
            'purchase_from' => ['required', 'string', 'max:200'],
            'policy_number' => ['required', 'string', 'max:100'],
            'policy_date' => ['nullable', 'date'],
            'issue_date' => ['required', 'date'],
            'expiry_date' => ['required', 'date', 'after_or_equal:issue_date'],
            'status' => ['required', Rule::in(['running', 'pending', 'expired', 'cancelled'])],
            'insurance_type' => ['required', Rule::in(['comprehensive', 'third_party', 'standalone_od', 'commercial_package'])],
            'remark' => ['nullable', 'string', 'max:2000'],
            'od_premium' => ['required', 'numeric', 'min:0'],
            'tp_premium' => ['required', 'numeric', 'min:0'],
            'addon_premium' => ['required', 'numeric', 'min:0'],
            'gst_other_charges' => ['required', 'numeric', 'min:0'],
            'commission_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'customer_discount' => ['required', 'numeric', 'min:0'],
            'agent' => ['nullable', 'string', 'max:200'],
            'agent_commission' => ['required', 'numeric', 'min:0'],
            'payment_details' => ['sometimes', 'array'],
            'tds_percent' => ['prohibited'],
            'tds_amount' => ['prohibited'],
            'net_commission' => ['prohibited'],
        ];
    }
}
