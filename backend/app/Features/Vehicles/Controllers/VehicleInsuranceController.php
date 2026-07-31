<?php

namespace App\Features\Vehicles\Controllers;

use App\Features\Vehicles\Models\Vehicle;
use App\Features\Vehicles\Requests\VehicleInsuranceRequest;
use App\Features\Vehicles\Services\InsuranceCalculationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class VehicleInsuranceController
{
    public function __construct(private readonly InsuranceCalculationService $calculator)
    {
    }

    public function index(Request $request, string $vehicle): JsonResponse
    {
        $vehicleModel = $this->vehicle($request, $vehicle);
        $this->authorize($request, 'vehicle.view');

        return response()->json([
            'success' => true,
            'data' => $vehicleModel->insurances()->latest('issue_date')->latest()->get(),
        ]);
    }

    public function store(VehicleInsuranceRequest $request, string $vehicle): JsonResponse
    {
        $vehicleModel = $this->vehicle($request, $vehicle);
        $policy = DB::transaction(function () use ($request, $vehicleModel) {
            $policy = $vehicleModel->insurances()->create($this->policyData(
                $request->validated(), $vehicleModel, $request->user()?->id
            ));
            $this->saveDocument($request, $vehicleModel, $policy);
            $this->syncVehicle($vehicleModel, $policy);
            $this->timeline($vehicleModel, $request->user()?->id, $policy, 'created');
            return $policy->refresh();
        });

        return response()->json(['success' => true, 'data' => $policy], 201);
    }

    public function calculate(Request $request, string $vehicle): JsonResponse
    {
        $vehicleModel = $this->vehicle($request, $vehicle);
        $this->authorize($request, 'vehicle.view');
        $input = $request->validate([
            'insurance_type' => ['required', 'string'],
            'has_od_cover' => ['sometimes', 'boolean'],
            'has_tp_cover' => ['sometimes', 'boolean'],
            'od_premium' => ['nullable', 'numeric', 'min:0'],
            'tp_premium' => ['nullable', 'numeric', 'min:0'],
            'addon_premium' => ['nullable', 'numeric', 'min:0'],
            'other_charges' => ['nullable', 'numeric', 'min:0'],
            'customer_discount' => ['nullable', 'numeric', 'min:0'],
            'gst_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'commission_basis' => ['nullable', 'string'],
            'commission_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'od_commission_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'manual_commission_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->calculator->calculate($input, $vehicleModel->vehicle_type),
        ]);
    }

    public function update(VehicleInsuranceRequest $request, string $vehicle, string $insurance): JsonResponse
    {
        $vehicleModel = $this->vehicle($request, $vehicle);
        $policy = $vehicleModel->insurances()->findOrFail($insurance);
        DB::transaction(function () use ($request, $vehicleModel, $policy) {
            $policy->update($this->policyData($request->validated(), $vehicleModel, $request->user()?->id, false));
            $this->saveDocument($request, $vehicleModel, $policy);
            $this->syncVehicle($vehicleModel, $policy);
            $this->timeline($vehicleModel, $request->user()?->id, $policy, 'updated');
        });

        return response()->json(['success' => true, 'data' => $policy->refresh()]);
    }

    public function destroy(Request $request, string $vehicle, string $insurance): JsonResponse
    {
        $vehicleModel = $this->vehicle($request, $vehicle);
        $this->authorize($request, 'vehicle.delete');
        $vehicleModel->insurances()->findOrFail($insurance)->delete();

        return response()->json(['success' => true, 'data' => null]);
    }

    private function vehicle(Request $request, string $id): Vehicle
    {
        return Vehicle::where('tenant_id', $request->user()?->tenant_id)->findOrFail($id);
    }

    private function policyData(array $data, Vehicle $vehicle, ?string $actorId, bool $creating = true): array
    {
        $type = $data['insurance_type'];
        $data += [
            'has_od_cover' => $type !== 'third_party',
            'has_tp_cover' => $type !== 'standalone_od',
            'commission_on_od' => false, 'commission_on_tp' => false,
            'commission_on_net' => true, 'commission_on_addon' => false,
            'od_commission_percent' => 0, 'tp_commission_percent' => 0,
            'gst_other_charges' => 0, 'gst_percent' => 18, 'gst_amount' => 0,
            'other_charges' => 0,
        ];
        $vehicleType = strtolower((string) $vehicle->vehicle_type);
        if (! empty($data['insurance_company_id'])) {
            $companyExists = DB::table('insurance_companies')->where('tenant_id',$vehicle->tenant_id)
                ->where('id',$data['insurance_company_id'])->whereNull('deleted_at')->exists();
            if (! $companyExists) throw ValidationException::withMessages(['insurance_company_id'=>['Select a valid insurance company.']]);
        }
        $purchaseType = $data['purchase_from_type'] ?? 'direct_company';
        if ($purchaseType === 'agent') {
            $source = DB::table('insurance_purchase_sources')
                ->where('tenant_id', $vehicle->tenant_id)->where('id', $data['purchase_source_id'] ?? null)
                ->where('is_active', true)->whereNull('deleted_at')->first();
            if (! $source) {
                throw ValidationException::withMessages(['purchase_source_id' => ['Select a valid active purchase source.']]);
            }
            $data['purchase_from'] = $source->name;
            $data['commission_receivable_from_type'] = 'purchase_source';
            $data['commission_receivable_from_id'] = $source->id;
        } else {
            $data['purchase_from_type'] = 'direct_company';
            $data['purchase_source_id'] = null;
            $data['commission_receivable_from_type'] = 'insurance_company';
            $data['commission_receivable_from_id'] = $data['insurance_company_id'] ?? null;
        }
        $calculation = $this->calculator->calculate([
            ...$data,
            'manual_commission_amount' => $data['gross_commission'] ?? 0,
        ], $vehicleType);
        $grossCommission = $calculation['gross_commission'];

        if ((float) $data['agent_commission'] > $grossCommission) {
            throw ValidationException::withMessages([
                'agent_commission' => ['Agent commission cannot exceed gross commission.'],
            ]);
        }

        unset($data['tds_percent'], $data['tds_amount'], $data['net_commission']);

        return array_merge($data, [
            'tenant_id' => $vehicle->tenant_id,
            ...$calculation,
            'commission_on_od' => $calculation['commission_basis'] === InsuranceCalculationService::OD_PREMIUM,
            'commission_on_tp' => false,
            'commission_on_net' => $calculation['commission_basis'] === InsuranceCalculationService::NET_PREMIUM,
            'od_commission_percent' => $calculation['commission_basis'] === InsuranceCalculationService::OD_PREMIUM
                ? $calculation['commission_percent'] : 0,
            'od_commission_amount' => $calculation['commission_basis'] === InsuranceCalculationService::OD_PREMIUM
                ? $grossCommission : 0,
            'tp_commission_percent' => 0,
            'tp_commission_amount' => 0,
            'updated_by' => $actorId,
        ], $creating ? ['created_by' => $actorId] : []);
    }

    private function saveDocument(VehicleInsuranceRequest $request, Vehicle $vehicle, $policy): void
    {
        $file = $request->file('policy_document');
        if (! $file) return;

        $path = $file->store("tenants/{$vehicle->tenant_id}/vehicles/{$vehicle->id}/insurance", 'local');
        $document = $vehicle->documents()->create([
            'tenant_id' => $vehicle->tenant_id,
            'document_type' => 'insurance_policy',
            'file_id' => $path,
            'file_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
            'uploaded_by' => $request->user()?->id,
        ]);
        $policy->update(['policy_document_file_id' => $document->id]);
    }

    public function document(Request $request, string $vehicle, string $insurance)
    {
        $vehicleModel = $this->vehicle($request, $vehicle);
        $this->authorize($request, 'vehicle.view');
        $policy = $vehicleModel->insurances()->findOrFail($insurance);
        $document = $vehicleModel->documents()->findOrFail($policy->policy_document_file_id);
        abort_unless(Storage::disk('local')->exists($document->file_id), 404);
        return Storage::disk('local')->download($document->file_id, $document->file_name);
    }

    private function syncVehicle(Vehicle $vehicle, $policy): void
    {
        $vehicle->update(['insurance_expiry' => $policy->expiry_date, 'insurance_status' => 'active']);
    }

    private function timeline(Vehicle $vehicle, ?string $actor, $policy, string $action): void
    {
        $vehicle->timelineEvents()->create([
            'tenant_id' => $vehicle->tenant_id, 'actor_id' => $actor,
            'event_type' => "insurance.policy.{$action}",
            'title' => "Insurance Policy ".ucfirst($action),
            'description' => "{$policy->company_name} policy {$policy->policy_number} was {$action}.",
            'metadata' => ['policy_id' => $policy->id, 'expiry_date' => $policy->expiry_date?->format('Y-m-d'),
                'long_term_tp_expiry' => $policy->long_term_tp_expiry?->format('Y-m-d')],
        ]);
    }

    private function authorize(Request $request, string $permission): void
    {
        abort_unless($request->user()?->can($permission), 403);
    }
}
