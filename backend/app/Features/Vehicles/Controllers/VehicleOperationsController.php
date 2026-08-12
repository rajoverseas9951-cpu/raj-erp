<?php

namespace App\Features\Vehicles\Controllers;

use App\Features\Vehicles\Models\Vehicle;
use App\Features\Vehicles\Services\VehicleModuleApplicabilityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class VehicleOperationsController
{
    private const TABLES = [
        'puc' => 'vehicle_pucs', 'fitness' => 'vehicle_fitnesses', 'permit' => 'vehicle_permits', 'tax' => 'vehicle_taxes',
        'counter_tax' => 'vehicle_counter_taxes', 'hsrp' => 'vehicle_hsrp_records', 'sld' => 'vehicle_sld_records',
        'vltd' => 'vehicle_vltd_records', 'rto_process' => 'vehicle_rto_processes', 'transfer' => 'vehicle_transfer_processes', 'payment' => 'vehicle_payments',
        'agent_payment' => 'vehicle_agent_payments', 'other_payment' => 'vehicle_other_payments',
    ];

    private const FINANCIAL = ['payment', 'agent_payment', 'other_payment'];
    private const EXPIRY_MODULES = ['puc', 'fitness', 'permit', 'tax', 'counter_tax', 'sld', 'vltd'];

    public function profile(Request $request, string $vehicle, VehicleModuleApplicabilityService $applicability)
    {
        $this->authorize($request, 'vehicle.view');
        $model = $this->vehicle($request, $vehicle);
        $rules = $applicability->modules($model);
        $summaries = [];
        foreach (self::TABLES as $module => $table) {
            if (! $this->isEnabled($rules, $module)) continue;
            if (in_array($module, self::FINANCIAL, true) && ! $this->financial($request)) continue;
            $latest = DB::table($table)->where('tenant_id', $model->tenant_id)->where('vehicle_id', $model->id)->whereNull('deleted_at')->latest('created_at')->first();
            $summaries[$module] = ['count' => DB::table($table)->where('tenant_id', $model->tenant_id)->where('vehicle_id', $model->id)->whereNull('deleted_at')->count(), 'status' => VehicleModuleApplicabilityService::status($latest?->expiry_date ?? null, (bool) $latest), 'current' => $latest];
        }
        if ($this->isEnabled($rules, 'insurance')) {
            $insuranceQuery = DB::table('vehicle_insurances')->where('tenant_id', $model->tenant_id)->where('vehicle_id', $model->id)->whereNull('deleted_at')->whereNull('archived_at')->whereNotIn('status', ['cancelled']);
            $latestInsurance = (clone $insuranceQuery)->orderByDesc('expiry_date')->latest('created_at')->first();
            $summaries['insurance'] = [
                'count' => (clone $insuranceQuery)->count(),
                'status' => VehicleModuleApplicabilityService::status($latestInsurance?->expiry_date ?? null, (bool) $latestInsurance),
                'current' => $latestInsurance,
            ];
        }
        $groups = $rules['groups'];
        foreach ($groups as $name => $modules) $groups[$name] = array_values(array_filter($modules, fn ($module) => ! in_array($module, self::FINANCIAL, true) || $this->financial($request)));
        $payments = DB::table('vehicle_payments')->where('tenant_id', $model->tenant_id)->where('vehicle_id', $model->id)->whereNull('deleted_at');
        $billed = (float) (clone $payments)->sum('billed_amount');
        $received = (float) (clone $payments)->sum('paid_amount');
        return response()->json(['success' => true, 'data' => ['applicability' => array_merge($rules, ['groups' => $groups]), 'modules' => $summaries, 'balances' => ['billed' => $billed, 'received' => $received, 'outstanding' => $billed - $received]]]);
    }

    public function index(Request $request, string $vehicle, string $module)
    {
        $this->authorize($request, 'vehicle.view');
        $model = $this->vehicle($request, $vehicle);
        $table = $this->table($module);
        $this->guardApplicable($model, $module);
        $this->guardFinancial($request, $module);
        $query = DB::table($table)->where('tenant_id', $model->tenant_id)->where('vehicle_id', $model->id)->whereNull('deleted_at');
        if ($request->filled('status')) $query->where('status', $request->query('status'));
        if ($request->filled('search')) $query->where(fn ($q) => $q->where('reference_number', 'like', '%'.$request->query('search').'%')->orWhere('notes', 'like', '%'.$request->query('search').'%'));
        if ($request->filled('expires_within')) $query->whereBetween('expiry_date', [now()->toDateString(), now()->addDays(min(30, max(1, (int) $request->query('expires_within'))))->toDateString()]);
        $rows = $query->latest('created_at')->get()->map(function ($row) use ($model, $module) {
            $data = $this->present($row);
            $data['documents'] = DB::table('vehicle_operation_documents')->where('tenant_id', $model->tenant_id)->where('vehicle_id', $model->id)->where('module', $module)->where('record_id', $row->id)->whereNull('deleted_at')->get();
            return $data;
        });
        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function store(Request $request, string $vehicle, string $module)
    {
        $this->authorize($request, 'vehicle.update');
        $model = $this->vehicle($request, $vehicle); $table = $this->table($module); $this->guardApplicable($model, $module); $this->guardFinancial($request, $module, true); $data = $this->validated($request, $module);
        if (in_array($module, self::EXPIRY_MODULES, true)) $data['status'] = VehicleModuleApplicabilityService::status($data['expiry_date'] ?? null);
        $id = (string) Str::uuid(); $now = now();
        DB::transaction(function () use ($table, $data, $id, $now, $model, $request, $module) {
            DB::table($table)->insert(array_merge($data, ['id' => $id, 'tenant_id' => $model->tenant_id, 'vehicle_id' => $model->id, 'created_by' => $request->user()?->id, 'updated_by' => $request->user()?->id, 'created_at' => $now, 'updated_at' => $now]));
            DB::table('vehicle_timeline_events')->insert(['id' => (string) Str::uuid(), 'tenant_id' => $model->tenant_id, 'vehicle_id' => $model->id, 'actor_id' => $request->user()?->id, 'event_type' => 'vehicle.'.$module.'.created', 'title' => Str::headline($module).' added', 'description' => $data['reference_number'] ?? null, 'metadata' => json_encode(['record_id' => $id]), 'created_at' => $now, 'updated_at' => $now]);
        });
        return response()->json(['success' => true, 'data' => $this->present(DB::table($table)->where('id', $id)->first())], 201);
    }

    public function update(Request $request, string $vehicle, string $module, string $record)
    {
        $this->authorize($request, 'vehicle.update');
        $model = $this->vehicle($request, $vehicle); $table = $this->table($module); $this->guardApplicable($model, $module); $this->guardFinancial($request, $module, true); $data = $this->validated($request, $module, true);
        $query = DB::table($table)->where('tenant_id', $model->tenant_id)->where('vehicle_id', $model->id)->where('id', $record)->whereNull('deleted_at'); abort_unless($query->exists(), 404);
        if (in_array($module, self::EXPIRY_MODULES, true)) $data['status'] = VehicleModuleApplicabilityService::status($data['expiry_date'] ?? $query->value('expiry_date'));
        DB::transaction(function () use ($query, $data, $request, $module, $model, $record) {
            $query->update(array_merge($data, ['updated_by' => $request->user()?->id, 'updated_at' => now()]));
            if ($module === 'transfer' && ($data['status'] ?? null) === 'COMPLETED' && ($data['owner_change_confirmed'] ?? false) && ! empty($data['new_customer_id'])) $model->update(['customer_id' => $data['new_customer_id'], 'updated_by' => $request->user()?->id]);
            $this->timeline($model, $request, 'vehicle.'.$module.'.updated', Str::headline($module).' updated', $record);
        });
        return response()->json(['success' => true, 'data' => $this->present($query->first())]);
    }

    public function destroy(Request $request, string $vehicle, string $module, string $record)
    {
        $this->authorize($request, 'vehicle.delete'); $model = $this->vehicle($request, $vehicle); $table = $this->table($module); $this->guardApplicable($model, $module); $this->guardFinancial($request, $module, true);
        $updated = DB::table($table)->where('tenant_id', $model->tenant_id)->where('vehicle_id', $model->id)->where('id', $record)->whereNull('deleted_at')->update(['deleted_at' => now(), 'updated_by' => $request->user()?->id, 'updated_at' => now()]); abort_unless($updated, 404);
        $this->timeline($model, $request, 'vehicle.'.$module.'.deleted', Str::headline($module).' archived', $record); return response()->json(['success' => true, 'data' => null]);
    }

    public function uploadDocument(Request $request, string $vehicle, string $module, string $record)
    {
        $this->authorize($request, 'vehicle.documents'); $model = $this->vehicle($request, $vehicle); $table = $this->table($module);
        abort_unless(DB::table($table)->where('tenant_id', $model->tenant_id)->where('vehicle_id', $model->id)->where('id', $record)->whereNull('deleted_at')->exists(), 404);
        $request->validate(['document' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240']]); $file = $request->file('document'); $path = $file->store("tenants/{$model->tenant_id}/vehicles/{$model->id}/operations/{$module}", 'local'); $id = (string) Str::uuid();
        DB::table('vehicle_operation_documents')->insert(['id' => $id, 'tenant_id' => $model->tenant_id, 'vehicle_id' => $model->id, 'module' => $module, 'record_id' => $record, 'path' => $path, 'original_name' => $file->getClientOriginalName(), 'mime_type' => $file->getMimeType(), 'size_bytes' => $file->getSize(), 'uploaded_by' => $request->user()?->id, 'created_at' => now(), 'updated_at' => now()]);
        $this->timeline($model, $request, 'vehicle.document.uploaded', 'Supporting document uploaded', $record); return response()->json(['success' => true, 'data' => DB::table('vehicle_operation_documents')->where('id', $id)->first()], 201);
    }

    public function downloadDocument(Request $request, string $vehicle, string $document)
    {
        $this->authorize($request, 'vehicle.documents'); $model = $this->vehicle($request, $vehicle); $doc = DB::table('vehicle_operation_documents')->where('tenant_id', $model->tenant_id)->where('vehicle_id', $model->id)->where('id', $document)->whereNull('deleted_at')->first(); abort_unless($doc && Storage::disk('local')->exists($doc->path), 404); return Storage::disk('local')->download($doc->path, $doc->original_name);
    }

    public function deleteDocument(Request $request, string $vehicle, string $document)
    {
        $this->authorize($request, 'vehicle.documents'); $model = $this->vehicle($request, $vehicle); $doc = DB::table('vehicle_operation_documents')->where('tenant_id', $model->tenant_id)->where('vehicle_id', $model->id)->where('id', $document)->whereNull('deleted_at')->first(); abort_unless($doc, 404); Storage::disk('local')->delete($doc->path); DB::table('vehicle_operation_documents')->where('id', $doc->id)->update(['deleted_at' => now(), 'updated_at' => now()]); $this->timeline($model, $request, 'vehicle.document.deleted', 'Supporting document deleted', $doc->record_id); return response()->json(['success' => true, 'data' => null]);
    }

    public function override(Request $request, string $vehicle)
    {
        abort_unless($request->user()?->is_admin, 403); $model = $this->vehicle($request, $vehicle); $data = $request->validate(['module' => ['required', Rule::in(array_keys(self::TABLES))], 'enabled' => ['required', 'boolean'], 'reason' => ['required', 'string', 'max:500']]); $key = ['tenant_id' => $model->tenant_id, 'vehicle_id' => $model->id, 'module' => $data['module']]; $existing = DB::table('vehicle_module_overrides')->where($key)->first(); DB::table('vehicle_module_overrides')->updateOrInsert($key, ['id' => $existing?->id ?? (string) Str::uuid(), 'enabled' => $data['enabled'], 'reason' => $data['reason'], 'created_by' => $request->user()?->id, 'created_at' => $existing?->created_at ?? now(), 'updated_at' => now(), 'deleted_at' => null]); return response()->json(['success' => true, 'data' => $data]);
    }

    public function masters(Request $request, string $type)
    {
        $this->authorize($request, 'vehicle.view'); abort_unless(in_array($type, ['permit_type', 'rto_work_type', 'payment_type', 'other_payment_category'], true), 404); return response()->json(['success' => true, 'data' => DB::table('vehicle_operation_masters')->where('tenant_id', (string) $request->user()?->tenant_id)->where('type', $type)->where('is_active', true)->whereNull('deleted_at')->orderBy('name')->get()]);
    }

    public function storeMaster(Request $request, string $type)
    {
        $this->authorize($request, 'vehicle.update'); abort_unless(in_array($type, ['permit_type', 'rto_work_type', 'payment_type', 'other_payment_category'], true), 404); $data = $request->validate(['name' => ['required', 'string', 'max:160'], 'code' => ['nullable', 'string', 'max:60']]); $tenant = (string) $request->user()?->tenant_id; $existing = DB::table('vehicle_operation_masters')->where('tenant_id', $tenant)->where('type', $type)->whereRaw('LOWER(name) = ?', [strtolower(trim($data['name']))])->whereNull('deleted_at')->first(); if ($existing) return response()->json(['success' => true, 'data' => $existing]); $id = (string) Str::uuid(); DB::table('vehicle_operation_masters')->insert(['id' => $id, 'tenant_id' => $tenant, 'type' => $type, 'name' => trim($data['name']), 'code' => $data['code'] ?? null, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]); return response()->json(['success' => true, 'data' => DB::table('vehicle_operation_masters')->where('id', $id)->first()], 201);
    }

    private function validated(Request $request, string $module, bool $partial = false): array
    {
        $tenant = (string) $request->user()?->tenant_id;
        $rules = ['period' => ['nullable', 'string', 'max:80'], 'reference_number' => ['nullable', 'string', 'max:120'], 'receipt_date' => ['nullable', 'date'], 'issue_date' => ['nullable', 'date'], 'expiry_date' => ['nullable', 'date', 'after_or_equal:issue_date'], 'amount' => ['nullable', 'numeric', 'min:0'], 'party_amount' => ['nullable', 'numeric', 'min:0'], 'status' => [$partial ? 'sometimes' : 'nullable', 'string', 'max:40'], 'notes' => ['nullable', 'string', 'max:2000'], 'permit_type' => [$module === 'permit' ? 'required' : 'sometimes', 'string', 'max:100'], 'state' => ['nullable', 'string', 'max:100'], 'dealer_name' => ['nullable', 'string', 'max:160'], 'dealer_amount' => ['nullable', 'numeric', 'min:0'], 'order_date' => ['nullable', 'date'], 'received_date' => ['nullable', 'date'], 'delivery_date' => ['nullable', 'date'], 'vendor' => ['nullable', 'string', 'max:160'], 'fitment_date' => ['nullable', 'date'], 'work_type' => [$module === 'rto_process' ? 'required' : 'sometimes', 'string', 'max:160'], 'process_date' => ['nullable', 'date'], 'rto_office' => ['nullable', 'string', 'max:160'], 'broker' => ['nullable', 'string', 'max:160'], 'assigned_agent' => ['nullable', 'string', 'max:160'], 'external_agent' => ['nullable', 'string', 'max:160'], 'agent_amount' => ['nullable', 'numeric', 'min:0'], 'faceless_appointment' => ['nullable', 'boolean'], 'approval_date' => ['nullable', 'date'], 'rc_received_date' => ['nullable', 'date'], 'rc_delivered_date' => ['nullable', 'date'], 'invoice_number' => ['nullable', 'string', 'max:120'], 'current_customer_id' => ['nullable', 'uuid'], 'new_customer_id' => ['nullable', 'uuid', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenant)->whereNull('deleted_at'))], 'new_owner_name' => ['nullable', 'string', 'max:160'], 'application_date' => ['nullable', 'date'], 'completion_date' => ['nullable', 'date'], 'owner_change_confirmed' => ['nullable', 'boolean'], 'rto_process_id' => ['nullable', 'uuid', Rule::exists('vehicle_rto_processes', 'id')->where(fn ($q) => $q->where('tenant_id', $tenant)->whereNull('deleted_at'))], 'voucher_id' => ['nullable', 'uuid', Rule::exists('accounting_vouchers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenant)->whereNull('deleted_at'))], 'ledger_id' => ['nullable', 'uuid', Rule::exists('ledgers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenant)->whereNull('deleted_at'))], 'payment_type' => ['nullable', 'string', 'max:80'], 'account' => ['nullable', 'string', 'max:160'], 'purpose' => ['nullable', 'string', 'max:160'], 'billed_amount' => ['nullable', 'numeric', 'min:0'], 'paid_amount' => ['nullable', 'numeric', 'min:0'], 'party_name' => ['nullable', 'string', 'max:160']];
        $columns = DB::getSchemaBuilder()->getColumnListing($this->table($module)); return $request->validate(array_intersect_key($rules, array_flip($columns)));
    }

    private function present(object $row): array { $data = (array) $row; $data['derived_status'] = VehicleModuleApplicabilityService::status($row->expiry_date ?? null, true); return $data; }
    private function table(string $module): string { abort_unless(isset(self::TABLES[$module]), 404); return self::TABLES[$module]; }
    private function vehicle(Request $request, string $id): Vehicle { return Vehicle::where('tenant_id', (string) $request->user()?->tenant_id)->findOrFail($id); }
    private function financial(Request $request): bool { return (bool) ($request->user()?->is_admin || $request->user()?->can('vehicle.financial.view')); }
    private function guardFinancial(Request $request, string $module, bool $edit = false): void { if (in_array($module, self::FINANCIAL, true)) abort_unless($request->user()?->is_admin || $request->user()?->can($edit ? 'vehicle.financial.edit' : 'vehicle.financial.view'), 403); }
    private function guardApplicable(Vehicle $vehicle, string $module): void { $rules = app(VehicleModuleApplicabilityService::class)->modules($vehicle); abort_unless($this->isEnabled($rules, $module), 422, 'Module is not applicable to this vehicle.'); }
    private function isEnabled(array $rules, string $module): bool { return collect($rules['groups'])->flatten()->contains($module); }
    private function authorize(Request $request, string $permission): void { abort_unless($request->user()?->can($permission), 403); }
    private function timeline(Vehicle $vehicle, Request $request, string $type, string $title, string $record): void { DB::table('vehicle_timeline_events')->insert(['id' => (string) Str::uuid(), 'tenant_id' => $vehicle->tenant_id, 'vehicle_id' => $vehicle->id, 'actor_id' => $request->user()?->id, 'event_type' => $type, 'title' => $title, 'description' => null, 'metadata' => json_encode(['record_id' => $record]), 'created_at' => now(), 'updated_at' => now()]); }
}
