<?php

namespace App\Features\Vehicles\Requests;

use App\Features\Vehicles\Services\CommercialVehicleDetector;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class VehicleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can($this->isMethod('post') ? 'vehicle.create' : 'vehicle.update') ?? false;
    }

    public function rules(): array
    {
        $commercial = $this->isCommercialVehicle();

        return [
            'customer_id' => ['required', 'uuid', 'exists:customers,id'],
            'manufacturer_id' => ['nullable', 'uuid'],
            'model_id' => ['nullable', 'uuid'],
            'colour_id' => ['nullable', 'uuid'],
            'vehicle_class_id' => ['nullable', 'uuid'],
            'vehicle_category_id' => ['nullable', 'uuid'],
            'fuel_type_id' => ['nullable', 'uuid'],
            'rto_office_id' => ['nullable', 'uuid'],
            'vehicle_type_id' => ['nullable', 'uuid'],
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
            'manufacturing_year' => ['nullable', 'integer', 'min:1900', 'max:2100'],
            'colour' => ['nullable', 'string', 'max:80'],
            'fuel_type' => ['nullable', 'string', 'max:80'],
            'seating_capacity' => ['nullable', 'integer', 'min:0'],
            'cubic_capacity' => ['nullable', 'numeric', 'min:0'],
            'gross_weight' => [
                Rule::requiredIf($commercial),
                'nullable',
                'integer',
                'min:0',
                ...($this->filled('unladen_weight') ? ['gte:unladen_weight'] : []),
            ],
            'unladen_weight' => ['nullable', 'integer', 'min:0'],
            'number_of_cylinders' => ['nullable', 'integer', 'min:0', 'max:32'],
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
        ];
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('gross_weight')) {
            $alias = $this->input('gross_vehicle_weight', $this->input('laden_weight'));
            if ($alias !== null && $alias !== '') {
                $this->merge(['gross_weight' => $alias]);
            }
        }
    }

    private function isCommercialVehicle(): bool
    {
        $values = $this->only(['vehicle_type', 'vehicle_class', 'vehicle_category']);
        $ids = array_values(array_filter($this->only([
            'vehicle_type_id', 'vehicle_class_id', 'vehicle_category_id',
        ])));

        if ($ids !== []) {
            $tenantId = (string) $this->user()?->tenant_id;
            $masters = DB::table('vehicle_masters')
                ->where('tenant_id', $tenantId)
                ->whereIn('id', $ids)
                ->whereNull('deleted_at')
                ->get(['name', 'code']);
            foreach ($masters as $master) {
                $values[] = $master->name;
                $values[] = $master->code;
            }
        }

        return CommercialVehicleDetector::matches($values);
    }
}
