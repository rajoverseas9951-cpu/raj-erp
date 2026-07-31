<?php

namespace App\Features\Vehicles\Controllers;

use App\Features\Vehicles\Models\Vehicle;
use App\Features\Vehicles\Requests\VehicleInsuranceRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class VehicleInsuranceController
{
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
        $modernCommission = array_key_exists('commission_on_od', $data)
            || array_key_exists('commission_on_tp', $data) || array_key_exists('commission_on_net', $data);
        $type = $data['insurance_type'];
        $data += [
            'has_od_cover' => $type !== 'third_party',
            'has_tp_cover' => $type !== 'standalone_od',
            'net_premium' => 0, 'tp_net_premium' => 0,
            'commission_on_od' => false, 'commission_on_tp' => false,
            'commission_on_net' => true, 'commission_on_addon' => false,
            'od_commission_percent' => 0, 'tp_commission_percent' => 0,
            'gst_other_charges' => 0, 'gst_percent' => 0, 'gst_amount' => 0,
            'other_charges' => 0,
        ];
        $vehicleType = strtolower((string) $vehicle->vehicle_type);
        $automaticGst = in_array($vehicleType, ['private_car', 'two_wheeler'], true);
        if ($automaticGst) {
            if (empty($data['has_od_cover'])) $data['od_premium'] = 0;
            if (empty($data['has_tp_cover'])) $data['tp_premium'] = 0;
            $data['net_premium'] = round(
                (float) $data['od_premium'] + (float) $data['tp_premium'] + (float) $data['addon_premium'],
                2
            );
            $data['gst_percent'] = 18;
            $data['gst_amount'] = round((float) $data['net_premium'] * 18 / 100, 2);
            $grossPremium = round(
                (float) $data['net_premium'] + (float) $data['gst_amount'] + (float) $data['other_charges'],
                2
            );
        } else {
            $grossPremium = round(
                (float) $data['od_premium'] + (float) $data['tp_premium']
                + (float) $data['addon_premium'] + (float) $data['gst_other_charges'],
                2
            );
        }
        $customerPay = round($grossPremium - (float) $data['customer_discount'], 2);
        if ($customerPay < 0) {
            throw ValidationException::withMessages([
                'customer_discount' => ['Customer discount cannot exceed gross premium.'],
            ]);
        }
        $commercial = in_array($vehicleType, ['taxi', 'lgv', 'hgv', 'commercial', 'goods_vehicle', 'passenger_commercial'], true);
        $addonBase = ! empty($data['commission_on_addon']) ? (float) $data['addon_premium'] : 0;

        if (! $modernCommission) {
            $grossCommission = round($grossPremium * (float) $data['commission_percent'] / 100, 2);
            $odCommission = $tpCommission = 0;
        } elseif ($commercial || ! empty($data['commission_on_net'])) {
            $grossCommission = round(
                ((float) ($data['net_premium'] ?? 0) + ($automaticGst ? 0 : $addonBase))
                * (float) $data['commission_percent'] / 100,
                2
            );
            $odCommission = $tpCommission = 0;
        } else {
            $odCommission = ! empty($data['commission_on_od'])
                ? round(((float) $data['od_premium'] + $addonBase) * (float) ($data['od_commission_percent'] ?? 0) / 100, 2) : 0;
            $tpBase = (float) ($data['tp_net_premium'] ?? 0) ?: (float) $data['tp_premium'];
            $tpCommission = ! empty($data['commission_on_tp'])
                ? round($tpBase * (float) ($data['tp_commission_percent'] ?? 0) / 100, 2) : 0;
            $grossCommission = round($odCommission + $tpCommission, 2);
        }

        if ((float) $data['agent_commission'] > $grossCommission) {
            throw ValidationException::withMessages([
                'agent_commission' => ['Agent commission cannot exceed gross commission.'],
            ]);
        }

        unset($data['tds_percent'], $data['tds_amount'], $data['net_commission']);

        return array_merge($data, [
            'tenant_id' => $vehicle->tenant_id,
            'gross_premium' => $grossPremium,
            'gross_commission' => $grossCommission,
            'od_commission_amount' => $odCommission,
            'tp_commission_amount' => $tpCommission,
            'customer_pay' => $customerPay,
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
