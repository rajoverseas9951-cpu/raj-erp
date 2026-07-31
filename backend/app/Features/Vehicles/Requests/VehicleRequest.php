<?php

namespace App\Features\Vehicles\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VehicleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can($this->isMethod('post') ? 'vehicle.create' : 'vehicle.update') ?? false;
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'uuid', 'exists:customers,id'],
            'manufacturer_id' => ['nullable', 'uuid'],
            'model_id' => ['nullable', 'uuid'],
            'colour_id' => ['nullable', 'uuid'],
            'vehicle_class_id' => ['nullable', 'uuid'],
            'vehicle_category_id' => ['nullable', 'uuid'],
            'fuel_type_id' => ['nullable', 'uuid'],
            'vehicle_number' => ['required', 'string', 'max:32'],
            'registration_date' => ['nullable', 'date'],
            'registration_authority' => ['nullable', 'string', 'max:160'],
            'state' => ['nullable', 'string', 'max:120'],
            'district' => ['nullable', 'string', 'max:120'],
            'vehicle_class' => ['nullable', 'string', 'max:120'],
            'vehicle_category' => ['nullable', 'string', 'max:120'],
            'vehicle_type' => ['nullable', 'string', 'max:120'],
            'manufacturer' => ['nullable', 'string', 'max:160'],
            'model' => ['nullable', 'string', 'max:160'],
            'variant' => ['nullable', 'string', 'max:160'],
            'manufacturing_year' => ['nullable', 'integer', 'min:1900', 'max:2100'],
            'colour' => ['nullable', 'string', 'max:80'],
            'fuel_type' => ['nullable', 'string', 'max:80'],
            'seating_capacity' => ['nullable', 'integer', 'min:0'],
            'cubic_capacity' => ['nullable', 'integer', 'min:0'],
            'gross_weight' => ['nullable', 'integer', 'min:0'],
            'unladen_weight' => ['nullable', 'integer', 'min:0'],
            'chassis_number' => ['required', 'string', 'max:120'],
            'engine_number' => ['required', 'string', 'max:120'],
            'hypothecation' => ['boolean'],
            'financier' => ['nullable', 'string', 'max:200'],
            'insurance_status' => ['required', 'in:not_added,active,expired,expiring_soon'],
            'fitness_status' => ['required', 'in:not_added,valid,expired,expiring_soon'],
            'permit_status' => ['required', 'in:not_added,valid,expired,expiring_soon'],
            'tax_status' => ['required', 'in:not_added,paid,due,overdue'],
            'puc_status' => ['required', 'in:not_added,valid,expired,expiring_soon'],
            'insurance_expiry' => ['nullable', 'date'],
            'puc_expiry' => ['nullable', 'date'],
            'fitness_expiry' => ['nullable', 'date'],
            'permit_expiry' => ['nullable', 'date'],
            'national_permit_expiry' => ['nullable', 'date'],
            'tax_expiry' => ['nullable', 'date'],
            'counter_tax_expiry' => ['nullable', 'date'],
            'payment_due' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
