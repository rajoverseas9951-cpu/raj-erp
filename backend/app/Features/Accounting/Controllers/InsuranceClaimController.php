<?php

namespace App\Features\Accounting\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InsuranceClaimController
{
    private const STATUSES = [
        'intimated', 'documents_pending', 'surveyor_assigned', 'survey_done', 'approval_pending',
        'approved', 'repair_in_progress', 'invoice_submitted', 'settlement_pending', 'settled',
        'closed', 'rejected',
    ];

    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()?->tenant_id;
        $query = DB::table('insurance_claims')->where('tenant_id', $tenantId)->whereNull('deleted_at');

        if ($request->filled('status')) $query->where('status', $request->string('status'));
        if ($request->filled('line')) $query->where('insurance_line', $request->string('line'));
        if ($request->filled('channel')) $query->where('business_channel', $request->string('channel'));
        if ($request->filled('q')) {
            $q = '%'.trim((string) $request->input('q')).'%';
            $query->where(function ($x) use ($q) {
                $x->where('claim_number', 'like', $q)
                    ->orWhere('policy_number', 'like', $q)
                    ->orWhere('customer_name', 'like', $q)
                    ->orWhere('customer_mobile', 'like', $q)
                    ->orWhere('registration_number', 'like', $q);
            });
        }

        $claims = $query->orderByRaw("CASE WHEN status IN ('settled','closed','rejected') THEN 1 ELSE 0 END")
            ->orderByRaw('next_follow_up_at IS NULL')
            ->orderBy('next_follow_up_at')
            ->orderByDesc('created_at')
            ->limit(250)
            ->get()
            ->map(fn ($row) => $this->decode($row));

        $summary = DB::table('insurance_claims')->where('tenant_id', $tenantId)->whereNull('deleted_at')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN status NOT IN ('settled','closed','rejected') THEN 1 ELSE 0 END) as open")
            ->selectRaw("SUM(CASE WHEN status IN ('documents_pending','approval_pending','settlement_pending') THEN 1 ELSE 0 END) as pending")
            ->selectRaw("SUM(CASE WHEN next_follow_up_at IS NOT NULL AND next_follow_up_at <= NOW() AND status NOT IN ('settled','closed','rejected') THEN 1 ELSE 0 END) as follow_up_due")
            ->selectRaw('COALESCE(SUM(settlement_amount),0) as settled_amount')
            ->first();

        return response()->json(['success' => true, 'data' => $claims, 'summary' => $summary]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()?->tenant_id;
        $claim = DB::table('insurance_claims')->where('tenant_id', $tenantId)->where('id', $id)->whereNull('deleted_at')->first();
        abort_unless($claim, 404);
        $updates = DB::table('insurance_claim_updates')->where('tenant_id', $tenantId)->where('claim_id', $id)->orderByDesc('created_at')->get();
        return response()->json(['success' => true, 'data' => $this->decode($claim), 'updates' => $updates]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $id = (string) Str::uuid();
        $now = now();
        DB::transaction(function () use ($request, $data, $id, $now) {
            DB::table('insurance_claims')->insert([
                'id' => $id,
                'tenant_id' => $request->user()?->tenant_id,
                ...$data,
                'form_data' => json_encode($data['form_data'] ?? [], JSON_UNESCAPED_UNICODE),
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $this->addUpdate($request, $id, $data['status'] ?? 'intimated', 'Claim created / intimated.', $data['next_follow_up_at'] ?? null);
        });
        return $this->show($request, $id)->setStatusCode(201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()?->tenant_id;
        abort_unless(DB::table('insurance_claims')->where('tenant_id', $tenantId)->where('id', $id)->whereNull('deleted_at')->exists(), 404);
        $data = $this->validated($request, false);
        if (array_key_exists('form_data', $data)) $data['form_data'] = json_encode($data['form_data'] ?? [], JSON_UNESCAPED_UNICODE);
        $data['updated_by'] = $request->user()?->id;
        $data['updated_at'] = now();
        DB::table('insurance_claims')->where('tenant_id', $tenantId)->where('id', $id)->update($data);
        return $this->show($request, $id);
    }

    public function addNote(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()?->tenant_id;
        $claim = DB::table('insurance_claims')->where('tenant_id', $tenantId)->where('id', $id)->whereNull('deleted_at')->first();
        abort_unless($claim, 404);
        $data = $request->validate([
            'note' => ['required', 'string', 'max:5000'],
            'status' => ['nullable', 'string', 'in:'.implode(',', self::STATUSES)],
            'follow_up_at' => ['nullable', 'date'],
        ]);
        DB::transaction(function () use ($request, $claim, $data, $id, $tenantId) {
            $this->addUpdate($request, $id, $data['status'] ?? $claim->status, $data['note'], $data['follow_up_at'] ?? null);
            $changes = ['updated_by' => $request->user()?->id, 'updated_at' => now()];
            if (!empty($data['status'])) $changes['status'] = $data['status'];
            if (array_key_exists('follow_up_at', $data)) $changes['next_follow_up_at'] = $data['follow_up_at'];
            DB::table('insurance_claims')->where('tenant_id', $tenantId)->where('id', $id)->update($changes);
        });
        return $this->show($request, $id);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()?->tenant_id;
        DB::table('insurance_claims')->where('tenant_id', $tenantId)->where('id', $id)->whereNull('deleted_at')->update([
            'deleted_at' => now(), 'updated_by' => $request->user()?->id, 'updated_at' => now(),
        ]);
        return response()->json(['success' => true]);
    }

    private function validated(Request $request, bool $creating = true): array
    {
        $required = $creating ? 'required' : 'sometimes';
        return $request->validate([
            'policy_id' => ['nullable', 'uuid'],
            'vehicle_id' => ['nullable', 'uuid'],
            'insurance_line' => [$required, 'string', 'max:40'],
            'business_channel' => [$required, 'string', 'in:retail,wholesale'],
            'policy_number' => ['nullable', 'string', 'max:120'],
            'insurance_company' => ['nullable', 'string', 'max:180'],
            'customer_name' => [$required, 'string', 'max:180'],
            'customer_mobile' => ['nullable', 'string', 'max:30'],
            'registration_number' => ['nullable', 'string', 'max:40'],
            'claim_type' => [$required, 'string', 'max:50'],
            'claim_number' => ['nullable', 'string', 'max:120'],
            'loss_date' => ['nullable', 'date_format:Y-m-d'],
            'loss_time' => ['nullable', 'date_format:H:i'],
            'loss_place' => ['nullable', 'string', 'max:255'],
            'intimation_date' => ['nullable', 'date_format:Y-m-d'],
            'status' => [$creating ? 'nullable' : 'sometimes', 'string', 'in:'.implode(',', self::STATUSES)],
            'surveyor_name' => ['nullable', 'string', 'max:180'],
            'surveyor_mobile' => ['nullable', 'string', 'max:30'],
            'garage_name' => ['nullable', 'string', 'max:180'],
            'garage_mobile' => ['nullable', 'string', 'max:30'],
            'estimated_loss' => ['nullable', 'numeric', 'min:0'],
            'approved_amount' => ['nullable', 'numeric', 'min:0'],
            'deductible_amount' => ['nullable', 'numeric', 'min:0'],
            'settlement_amount' => ['nullable', 'numeric', 'min:0'],
            'next_follow_up_at' => ['nullable', 'date'],
            'form_data' => ['nullable', 'array'],
            'remarks' => ['nullable', 'string', 'max:5000'],
        ]);
    }

    private function addUpdate(Request $request, string $claimId, ?string $status, string $note, $followUp): void
    {
        DB::table('insurance_claim_updates')->insert([
            'id' => (string) Str::uuid(),
            'tenant_id' => $request->user()?->tenant_id,
            'claim_id' => $claimId,
            'status' => $status,
            'note' => $note,
            'follow_up_at' => $followUp,
            'created_by' => $request->user()?->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function decode(object $row): object
    {
        $row->form_data = $row->form_data ? json_decode($row->form_data, true) : [];
        return $row;
    }
}
