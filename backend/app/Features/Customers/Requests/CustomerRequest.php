<?php

namespace App\Features\Customers\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can($this->isMethod('post') ? 'customer.create' : 'customer.update') ?? false;
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required','string','max:120'],
            'middle_name' => ['nullable','string','max:120'],
            'last_name' => ['required','string','max:120'],
            'mobile' => ['required','string','max:20'],
            'alternate_mobile' => ['nullable','string','max:20'],
            'whatsapp' => ['nullable','string','max:20'],
            'email' => ['nullable','email','max:255'],
            'date_of_birth' => ['nullable','date'],
            'gender' => ['nullable','in:male,female,other,prefer_not_to_say'],
            'aadhaar_number' => ['nullable','string','max:20'],
            'pan_number' => ['nullable','string','max:20'],
            'driving_licence_number' => ['nullable','string','max:80'],
            'passport_number' => ['nullable','string','max:80'],
            'voter_id' => ['nullable','string','max:80'],
            'current_address' => ['nullable','string','max:4000'],
            'permanent_address' => ['nullable','string','max:4000'],
            'city' => ['nullable','string','max:120'],
            'district' => ['nullable','string','max:120'],
            'state' => ['nullable','string','max:120'],
            'pincode' => ['nullable','string','max:12'],
            'occupation' => ['nullable','string','max:160'],
            'company_name' => ['nullable','string','max:200'],
            'gst_number' => ['nullable','string','max:32'],
            'remarks' => ['nullable','string','max:8000'],
            'tags' => ['array'],
            'tags.*' => ['string','max:40'],
            'priority' => ['required','in:low,normal,high,urgent'],
            'status' => ['required','in:active,inactive,blocked'],

            'create_ledger' => ['sometimes','boolean'],
            'ledger_group' => ['nullable','in:sundry_debtors,sundry_creditors,bank_accounts,cash_accounts,income_accounts,expense_accounts,other'],
            'opening_balance' => ['nullable','numeric','min:0'],
            'balance_type' => ['nullable','in:debit,credit'],
            'credit_limit' => ['nullable','numeric','min:0'],
            'credit_days' => ['nullable','integer','min:0','max:3650'],
            'gst_applicable' => ['sometimes','boolean'],
        ];
    }
}
