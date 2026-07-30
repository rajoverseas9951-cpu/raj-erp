<?php

namespace App\Features\Vehicles\Controllers;

use App\Features\Vehicles\Models\Vehicle;
use App\Features\Vehicles\Requests\VehicleInsuranceRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        $policy = $vehicleModel->insurances()->create($this->policyData(
            $request->validated(),
            $vehicleModel,
            $request->user()?->id,
        ));

        return response()->json(['success' => true, 'data' => $policy], 201);
    }

    public function update(VehicleInsuranceRequest $request, string $vehicle, string $insurance): JsonResponse
    {
        $vehicleModel = $this->vehicle($request, $vehicle);
        $policy = $vehicleModel->insurances()->findOrFail($insurance);
        $policy->update($this->policyData($request->validated(), $vehicleModel, $request->user()?->id, false));

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
        $grossPremium = round(
            (float) $data['od_premium']
            + (float) $data['tp_premium']
            + (float) $data['addon_premium']
            + (float) $data['gst_other_charges'],
            2
        );
        $grossCommission = round($grossPremium * (float) $data['commission_percent'] / 100, 2);
        $customerPay = max(0, round($grossPremium - (float) $data['customer_discount'], 2));

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
            'customer_pay' => $customerPay,
            'updated_by' => $actorId,
        ], $creating ? ['created_by' => $actorId] : []);
    }

    private function authorize(Request $request, string $permission): void
    {
        abort_unless($request->user()?->can($permission), 403);
    }
}
