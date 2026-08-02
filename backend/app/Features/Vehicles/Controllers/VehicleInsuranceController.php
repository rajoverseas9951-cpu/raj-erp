<?php

namespace App\Features\Vehicles\Controllers;

use App\Features\Vehicles\Models\Vehicle;
use App\Features\Vehicles\Requests\VehicleInsuranceRequest;
use App\Features\Vehicles\Services\InsuranceCalculationService;
use App\Features\Vehicles\Services\RecordDependencyService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class VehicleInsuranceController
{
    public function __construct(private readonly InsuranceCalculationService $calculator, private readonly RecordDependencyService $dependencies)
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
            $this->syncCommission($vehicleModel, $policy, $request->user()?->id);
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
            $this->syncCommission($vehicleModel, $policy, $request->user()?->id);
            $this->timeline($vehicleModel, $request->user()?->id, $policy, 'updated');
        });

        return response()->json(['success' => true, 'data' => $policy->refresh()]);
    }

    public function destroy(Request $request, string $vehicle, string $insurance): JsonResponse
    {
        $vehicleModel = $this->vehicle($request, $vehicle);
        $this->authorize($request, 'vehicle.delete');
        $policy = $vehicleModel->insurances()->findOrFail($insurance);
        $dependencies = $this->dependencies->policy($vehicleModel->tenant_id, $policy->id);
        if ($policy->status !== 'draft' || $dependencies) return response()->json([
            'success' => false,
            'message' => 'Delete is only allowed for a draft policy with no linked financial, claim, payment or document records. Cancel or archive this policy instead.',
            'dependency_counts' => $dependencies,
            'available_actions' => ['cancel', 'archive'],
        ], 409);
        DB::transaction(function () use ($request, $vehicleModel, $policy) {
            DB::table('insurance_commissions')->where('tenant_id', $vehicleModel->tenant_id)->where('policy_id', $policy->id)
                ->whereNull('deleted_at')->update(['deleted_at' => now(), 'updated_by' => $request->user()?->id, 'updated_at' => now()]);
            $this->timeline($vehicleModel, $request->user()?->id, $policy, 'deleted');
            $policy->forceDelete();
            $latest = $vehicleModel->insurances()->whereNotIn('status', ['cancelled', 'expired'])
                ->orderByDesc('expiry_date')->first();
            $vehicleModel->update([
                'insurance_expiry' => $latest?->expiry_date,
                'insurance_status' => $latest ? 'active' : 'not_added',
            ]);
        });

        return response()->json(['success' => true, 'data' => null]);
    }

    public function archive(Request $request, string $vehicle, string $insurance): JsonResponse
    {
        $vehicleModel = $this->vehicle($request, $vehicle);
        $this->authorize($request, 'vehicle.delete');
        $policy = $vehicleModel->insurances()->findOrFail($insurance);
        DB::transaction(function () use ($request, $vehicleModel, $policy) {
            $policy->update(['archived_at' => now(), 'archived_by' => $request->user()?->id, 'updated_by' => $request->user()?->id]);
            $this->timeline($vehicleModel, $request->user()?->id, $policy, 'archived');
            $this->syncLatestVehiclePolicy($vehicleModel);
        });
        return response()->json(['success' => true, 'message' => 'Policy archived successfully.', 'data' => $policy->refresh()]);
    }

    public function cancel(Request $request, string $vehicle, string $insurance): JsonResponse
    {
        $vehicleModel = $this->vehicle($request, $vehicle);
        $this->authorize($request, 'vehicle.update');
        $data = $request->validate([
            'cancellation_date' => ['required', 'date_format:Y-m-d'],
            'cancellation_reason' => ['required', 'string', 'max:2000'],
            'refund_amount' => ['nullable', 'numeric', 'min:0'],
            'cancellation_charges' => ['nullable', 'numeric', 'min:0'],
            'confirmed' => ['accepted'],
        ]);
        $policy = $vehicleModel->insurances()->findOrFail($insurance);
        if ($policy->status === 'cancelled') return response()->json(['success' => false, 'message' => 'Policy is already cancelled.'], 409);
        DB::transaction(function () use ($request, $vehicleModel, $policy, $data) {
            $commission = DB::table('insurance_commissions')->where('tenant_id', $vehicleModel->tenant_id)
                ->where('policy_id', $policy->id)->whereNull('deleted_at')->first();
            if ($commission) DB::table('insurance_commission_reversals')->updateOrInsert(
                ['tenant_id' => $vehicleModel->tenant_id, 'policy_id' => $policy->id],
                ['id' => (string) Str::uuid(), 'commission_id' => $commission->id, 'reversal_date' => $data['cancellation_date'],
                    'gross_commission' => -abs((float) $commission->gross_commission), 'tds_amount' => -abs((float) $commission->tds_amount),
                    'net_receivable' => -abs((float) $commission->net_receivable), 'received_amount' => -abs((float) $commission->received_amount),
                    'reason' => $data['cancellation_reason'], 'created_by' => $request->user()?->id, 'created_at' => now(), 'updated_at' => now()]
            );
            if ($commission) DB::table('insurance_commissions')->where('id', $commission->id)->where('tenant_id', $vehicleModel->tenant_id)
                ->update(['status' => 'cancelled', 'remarks' => trim(($commission->remarks ? $commission->remarks."\n" : '').'Reversed on cancellation: '.$data['cancellation_reason']), 'updated_by' => $request->user()?->id, 'updated_at' => now()]);
            $this->reverseAccounting($vehicleModel, $policy->id, $data['cancellation_date'], $data['cancellation_reason'], $request->user()?->id);
            $policy->update(['status' => 'cancelled', 'cancelled_at' => CarbonImmutable::parse($data['cancellation_date'])->startOfDay(),
                'cancelled_by' => $request->user()?->id, 'cancellation_reason' => $data['cancellation_reason'],
                'refund_amount' => $data['refund_amount'] ?? 0, 'cancellation_charges' => $data['cancellation_charges'] ?? 0,
                'updated_by' => $request->user()?->id]);
            $this->timeline($vehicleModel, $request->user()?->id, $policy, 'cancelled');
            $this->syncLatestVehiclePolicy($vehicleModel);
        });
        return response()->json(['success' => true, 'message' => 'Policy cancelled and accounting reversal recorded.', 'data' => $policy->refresh()]);
    }

    private function reverseAccounting(Vehicle $vehicle, string $policyId, string $date, string $reason, ?string $actor): void
    {
        $vouchers = DB::table('accounting_vouchers')->where('tenant_id', $vehicle->tenant_id)->where('policy_id', $policyId)
            ->where('status', 'posted')->whereNull('reversal_of_id')->whereNull('deleted_at')->get();
        foreach ($vouchers as $voucher) {
            if (DB::table('accounting_vouchers')->where('tenant_id', $vehicle->tenant_id)->where('reversal_of_id', $voucher->id)->exists()) continue;
            $reversalId = (string) Str::uuid();
            DB::table('accounting_vouchers')->insert([
                'id' => $reversalId, 'tenant_id' => $vehicle->tenant_id, 'policy_id' => $policyId, 'reversal_of_id' => $voucher->id,
                'voucher_number' => 'REV-'.substr(str_replace('-', '', $voucher->id), 0, 16), 'voucher_type' => 'journal',
                'voucher_date' => $date, 'reference_number' => $voucher->voucher_number,
                'narration' => 'Policy cancellation reversal: '.$reason, 'total_debit' => $voucher->total_credit,
                'total_credit' => $voucher->total_debit, 'status' => 'posted', 'created_by' => $actor, 'updated_by' => $actor,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            foreach (DB::table('accounting_voucher_entries')->where('tenant_id', $vehicle->tenant_id)->where('voucher_id', $voucher->id)->get() as $entry) {
                DB::table('accounting_voucher_entries')->insert([
                    'id' => (string) Str::uuid(), 'tenant_id' => $vehicle->tenant_id, 'voucher_id' => $reversalId,
                    'ledger_id' => $entry->ledger_id, 'entry_type' => $entry->entry_type === 'debit' ? 'credit' : 'debit',
                    'amount' => $entry->amount, 'description' => 'Reversal: '.($entry->description ?? $reason),
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
    }

    private function syncLatestVehiclePolicy(Vehicle $vehicle): void
    {
        $latest = $vehicle->insurances()->whereNull('archived_at')->whereNotIn('status', ['cancelled', 'expired'])
            ->orderByDesc('expiry_date')->first();
        $vehicle->update(['insurance_expiry' => $latest?->expiry_date, 'insurance_status' => $latest ? 'active' : 'not_added']);
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

    private function syncCommission(Vehicle $vehicle, $policy, ?string $actor): void
    {
        if (! $policy->insurance_company_id) return;
        $company = DB::table('insurance_companies')->where('tenant_id', $vehicle->tenant_id)
            ->where('id', $policy->insurance_company_id)->whereNull('deleted_at')->first();
        if (! $company) return;
        if ($policy->status === 'cancelled') {
            DB::table('insurance_commissions')->where('tenant_id', $vehicle->tenant_id)
                ->where('policy_id', $policy->id)->whereNull('deleted_at')
                ->update(['deleted_at' => now(), 'updated_by' => $actor, 'updated_at' => now()]);
            return;
        }
        $tdsPercent = (float) $company->tds_percent;
        if ($policy->purchase_from_type === 'agent' && $policy->purchase_source_id) {
            $source = DB::table('insurance_purchase_sources')->where('tenant_id', $vehicle->tenant_id)
                ->where('id', $policy->purchase_source_id)->whereNull('deleted_at')->first();
            $tdsPercent = $source && $source->tds_applicable ? (float) $source->tds_percent : 0;
        }
        $gross = round((float) $policy->gross_commission, 2);
        $tds = round($gross * $tdsPercent / 100, 2);
        $existing = DB::table('insurance_commissions')->where('tenant_id', $vehicle->tenant_id)
            ->where('policy_id', $policy->id)->first();
        if (! $existing) {
            $existing = DB::table('insurance_commissions')->where('tenant_id', $vehicle->tenant_id)
                ->whereNull('policy_id')->whereNull('deleted_at')
                ->where('insurance_company_id', $policy->insurance_company_id)
                ->whereRaw('LOWER(policy_number) = ?', [strtolower($policy->policy_number)])->first();
        }
        $received = min((float) ($existing->received_amount ?? 0), max(0, $gross - $tds));
        $values = [
            'insurance_company_id' => $policy->insurance_company_id,
            'statement_date' => $policy->policy_date ?? $policy->issue_date,
            'policy_number' => $policy->policy_number,
            'customer_name' => trim(($vehicle->customer?->first_name ?? '').' '.($vehicle->customer?->last_name ?? '')),
            'gross_premium' => round((float) $policy->gross_premium, 2),
            'commission_percent' => round((float) $policy->commission_percent, 3),
            'gross_commission' => $gross,
            'tds_percent' => $tdsPercent,
            'tds_amount' => $tds,
            'net_receivable' => round($gross - $tds, 2),
            'received_amount' => $received,
            'status' => $received >= ($gross - $tds) && $gross > 0 ? 'received' : ($received > 0 ? 'partial' : 'pending'),
            'updated_by' => $actor,
            'updated_at' => now(),
            'deleted_at' => null,
        ];
        if ($existing) {
            DB::table('insurance_commissions')->where('tenant_id', $vehicle->tenant_id)->where('id', $existing->id)
                ->update($values + ['policy_id' => $policy->id]);
            return;
        }
        DB::table('insurance_commissions')->insert($values + [
            'id' => (string) Str::uuid(), 'tenant_id' => $vehicle->tenant_id, 'policy_id' => $policy->id,
            'created_by' => $actor, 'created_at' => now(),
        ]);
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
