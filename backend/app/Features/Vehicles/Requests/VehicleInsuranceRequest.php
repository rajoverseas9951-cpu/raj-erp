<?php

namespace App\Features\Vehicles\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class VehicleInsuranceRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('payment_details'))) {
            $this->merge(['payment_details' => json_decode($this->input('payment_details'), true) ?: []]);
        }
        if (! $this->filled('business_channel')) {
            $this->merge(['business_channel' => 'retail']);
        }
    }

    public function authorize(): bool
    {
        return $this->user()?->can($this->isMethod('post') ? 'vehicle.create' : 'vehicle.update') ?? false;
    }

    public function rules(): array
    {
        return [
            'business_channel' => ['required', Rule::in(['retail', 'wholesale'])],
            'insurance_company_id' => ['nullable', 'uuid'],
            'company_name' => ['required', 'string', 'max:200'],
            'company_code' => ['nullable', 'string', 'max:30'],
            'purchase_from' => ['required', 'string', 'max:200'],
            'purchase_from_type' => ['sometimes', Rule::in(['direct_company', 'agent'])],
            'purchase_source_id' => ['nullable', 'uuid', 'required_if:purchase_from_type,agent'],
            'commission_basis' => ['nullable', Rule::in([
                'OD_PREMIUM', 'NET_PREMIUM', 'MANUAL',
                'od_premium', 'net_premium', 'manual',
            ])],
            'gross_commission' => ['sometimes', 'numeric', 'min:0'],
            'policy_number' => ['required', 'string', 'max:100'],
            'policy_date' => ['nullable', 'date'],
            'issue_date' => ['required', 'date'],
            'expiry_date' => ['required', 'date', 'after_or_equal:issue_date'],
            'status' => ['required', Rule::in(['draft', 'running', 'pending', 'expired', 'cancelled'])],
            'insurance_type' => ['required', Rule::in(['comprehensive', 'third_party', 'standalone_od', 'commercial_package'])],
            'remark' => ['nullable', 'string', 'max:2000'],
            'od_premium' => ['required', 'numeric', 'min:0'],
            'tp_premium' => ['required', 'numeric', 'min:0'],
            'addon_premium' => ['required', 'numeric', 'min:0'],
            'gst_other_charges' => ['sometimes', 'numeric', 'min:0'],
            'gst_percent' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'gst_amount' => ['sometimes', 'numeric', 'min:0'],
            'other_charges' => ['sometimes', 'numeric', 'min:0'],
            'net_premium' => ['nullable', 'numeric', 'min:0'],
            'has_od_cover' => ['sometimes', 'boolean'],
            'has_tp_cover' => ['sometimes', 'boolean'],
            'commission_on_od' => ['sometimes', 'boolean'],
            'commission_on_tp' => ['sometimes', 'boolean'],
            'commission_on_net' => ['sometimes', 'boolean'],
            'commission_on_addon' => ['sometimes', 'boolean'],
            'od_commission_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'tp_commission_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'commission_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'customer_discount' => ['required', 'numeric', 'min:0'],
            'agent' => ['nullable', 'string', 'max:200'],
            'agent_commission' => ['required', 'numeric', 'min:0'],
            'payment_details' => ['sometimes', 'array'],
            'long_term_tp_policy_number' => ['nullable', 'string', 'max:100'],
            'long_term_tp_expiry' => ['nullable', 'date', 'after_or_equal:policy_date'],
            'policy_document' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:15360'],
            'tds_percent' => ['prohibited'],
            'tds_amount' => ['prohibited'],
            'net_commission' => ['prohibited'],
        ];
    }

    public function after(): array
    {
        return [function ($validator): void {
            if (($this->has('has_od_cover') || $this->has('has_tp_cover'))
                && ! $this->boolean('has_od_cover') && ! $this->boolean('has_tp_cover')) {
                $validator->errors()->add('has_od_cover', 'At least one of OD Cover or TP Cover must be selected.');
            }
            if ($this->filled('long_term_tp_expiry') && $this->filled('policy_date')
                && $this->date('long_term_tp_expiry')->lt($this->date('policy_date'))) {
                $validator->errors()->add('long_term_tp_expiry', 'Long-term TP expiry cannot be before policy start date.');
            }
        }];
    }
}
