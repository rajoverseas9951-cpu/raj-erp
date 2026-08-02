<?php

namespace App\Features\Accounting\Controllers;

use App\Features\Accounting\Models\Ledger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InsuranceAccountingController
{
    private function tenant(Request $request): string
    {
        return (string) ($request->user()?->tenant_id ?? $request->header('X-Tenant-Id'));
    }

    public function companies(Request $request)
    {
        $this->authorize($request, 'vehicle.view');
        $query = DB::table('insurance_companies')->where('tenant_id', $this->tenant($request))->whereNull('deleted_at');
        if ($search = trim((string) $request->query('search'))) {
            $term = '%'.strtolower($search).'%';
            $query->where(fn ($q) => $q->whereRaw('LOWER(company_name) LIKE ?', [$term])
                ->orWhereRaw('LOWER(short_code) LIKE ?', [$term])->orWhereRaw('LOWER(agency_code_name) LIKE ?', [$term]));
        }
        return response()->json(['success' => true, 'data' => $query->orderBy('company_name')->get()]);
    }

    public function storeCompany(Request $request)
    {
        $this->authorize($request, 'vehicle.create');
        $data = $request->validate([
            'company_name' => ['required','string','max:200'],
            'short_code' => ['nullable','string','max:30'],
            'agency_code_name' => ['nullable','string','max:200'],
            'default_commission_percent' => ['required','numeric','min:0','max:100'],
            'tds_percent' => ['required','numeric','min:0','max:100'],
            'settlement_days' => ['required','integer','min:0'],
            'gst_number' => ['nullable','string','max:32'],
            'pan_number' => ['nullable','string','max:20'],
            'contact_person' => ['nullable','string','max:200'],
            'mobile' => ['nullable','string','max:20'],
            'email' => ['nullable','email','max:255'],
            'notes' => ['nullable','string','max:2000'],
        ]);

        $tenant = $this->tenant($request);
        if (DB::table('insurance_companies')->where('tenant_id', $tenant)->whereNull('deleted_at')->whereRaw('LOWER(company_name) = ?', [strtolower(trim($data['company_name']))])->exists()) {
            throw ValidationException::withMessages(['company_name' => ['This insurance company already exists.']]);
        }
        $actor = $request->user()?->id;
        $company = DB::transaction(function () use ($data, $tenant, $actor) {
            $name = strtoupper(trim($data['company_name']));
            $ledger = Ledger::create([
                'id' => (string) Str::uuid(), 'tenant_id' => $tenant, 'customer_id' => null,
                'ledger_name' => $name, 'ledger_group' => 'Sundry Creditors',
                'opening_balance' => 0, 'balance_type' => 'credit', 'credit_limit' => 0,
                'credit_days' => $data['settlement_days'], 'gst_applicable' => !empty($data['gst_number']),
                'status' => 'active', 'created_by' => $actor, 'updated_by' => $actor,
            ]);
            $id = (string) Str::uuid();
            DB::table('insurance_companies')->insert(array_merge($data, [
                'id' => $id, 'tenant_id' => $tenant, 'company_name' => $name,
                'ledger_id' => $ledger->id, 'status' => 'active', 'created_by' => $actor,
                'updated_by' => $actor, 'created_at' => now(), 'updated_at' => now(),
            ]));
            return DB::table('insurance_companies')->where('tenant_id', $tenant)->where('id', $id)->first();
        });
        return response()->json(['success' => true, 'data' => $company], 201);
    }

    public function updateCompany(Request $request, string $id)
    {
        $this->authorize($request, 'vehicle.update');
        $tenant = $this->tenant($request);
        abort_unless(DB::table('insurance_companies')->where('tenant_id', $tenant)->whereNull('deleted_at')->where('id', $id)->exists(), 404);
        $data = $request->validate([
            'company_name' => ['sometimes','string','max:200'], 'short_code' => ['nullable','string','max:30'],
            'agency_code_name' => ['nullable','string','max:200'], 'tds_percent' => ['sometimes','numeric','min:0','max:100'],
            'default_commission_percent' => ['sometimes','numeric','min:0','max:100'],
            'contact_person' => ['nullable','string','max:200'], 'mobile' => ['nullable','string','max:20'],
            'email' => ['nullable','email','max:255'], 'notes' => ['nullable','string','max:2000'],
            'status' => ['sometimes','in:active,inactive'],
        ]);
        if (isset($data['company_name'])) {
            $data['company_name'] = strtoupper(trim($data['company_name']));
            $duplicate = DB::table('insurance_companies')->where('tenant_id', $tenant)->whereNull('deleted_at')->where('id', '<>', $id)->whereRaw('LOWER(company_name) = ?', [strtolower($data['company_name'])])->exists();
            if ($duplicate) throw ValidationException::withMessages(['company_name' => ['This insurance company already exists.']]);
        }
        DB::table('insurance_companies')->where('tenant_id',$tenant)->where('id',$id)
            ->update(array_merge($data,['updated_by'=>$request->user()?->id,'updated_at'=>now()]));
        return response()->json(['success'=>true,'data'=>DB::table('insurance_companies')->where('tenant_id',$tenant)->where('id',$id)->first()]);
    }

    public function purchaseSources(Request $request)
    {
        $this->authorize($request, 'vehicle.view');
        $query = DB::table('insurance_purchase_sources')->where('tenant_id',$this->tenant($request))->whereNull('deleted_at');
        if ($search = trim((string)$request->query('search'))) {
            $query->whereRaw('LOWER(name) LIKE ?', ['%'.strtolower($search).'%']);
        }
        return response()->json(['success'=>true,'data'=>$query->orderBy('name')->get()]);
    }

    public function storePurchaseSource(Request $request)
    {
        $this->authorize($request, 'vehicle.create');
        $data = $this->purchaseSourceData($request);
        $tenant = $this->tenant($request);
        $this->validatePurchaseSourceRelations($tenant, $data);
        if (DB::table('insurance_purchase_sources')->where('tenant_id', $tenant)->whereNull('deleted_at')->whereRaw('LOWER(name) = ?', [strtolower(trim($data['name']))])->exists()) {
            throw ValidationException::withMessages(['name' => ['This purchase source already exists.']]);
        }
        $id = (string) Str::uuid();
        DB::table('insurance_purchase_sources')->insert(array_merge($data,[
            'id'=>$id,'tenant_id'=>$tenant,'created_by'=>$request->user()?->id,
            'updated_by'=>$request->user()?->id,'created_at'=>now(),'updated_at'=>now(),
        ]));
        return response()->json(['success'=>true,'data'=>DB::table('insurance_purchase_sources')->where('tenant_id',$tenant)->where('id',$id)->first()],201);
    }

    public function updatePurchaseSource(Request $request, string $id)
    {
        $this->authorize($request, 'vehicle.update');
        $tenant = $this->tenant($request);
        abort_unless(DB::table('insurance_purchase_sources')->where('tenant_id',$tenant)->whereNull('deleted_at')->where('id',$id)->exists(), 404);
        $data = $this->purchaseSourceData($request);
        $this->validatePurchaseSourceRelations($tenant, $data);
        $duplicate = DB::table('insurance_purchase_sources')->where('tenant_id', $tenant)->whereNull('deleted_at')->where('id', '<>', $id)->whereRaw('LOWER(name) = ?', [strtolower(trim($data['name']))])->exists();
        if ($duplicate) throw ValidationException::withMessages(['name' => ['This purchase source already exists.']]);
        DB::table('insurance_purchase_sources')->where('tenant_id',$tenant)->where('id',$id)
            ->update(array_merge($data,['updated_by'=>$request->user()?->id,'updated_at'=>now()]));
        return response()->json(['success'=>true,'data'=>DB::table('insurance_purchase_sources')->where('tenant_id',$tenant)->where('id',$id)->first()]);
    }

    private function purchaseSourceData(Request $request): array
    {
        $data = $request->validate([
            'name'=>['required','string','max:200'],'source_type'=>['required','in:individual_agent,insurance_broker,agency,other'],
            'mobile'=>['nullable','string','max:20'],'email'=>['nullable','email','max:255'],
            'linked_company_id'=>['nullable','uuid'],'tds_applicable'=>['sometimes','boolean'],
            'tds_percent'=>['sometimes','numeric','min:0','max:100'],'is_active'=>['sometimes','boolean'],
            'notes'=>['nullable','string','max:2000'],
        ]);
        $data['tds_applicable'] = (bool)($data['tds_applicable'] ?? false);
        $data['tds_percent'] = $data['tds_applicable'] ? (float)($data['tds_percent'] ?? 0) : 0;
        $data['is_active'] = (bool)($data['is_active'] ?? true);
        return $data;
    }

    private function validatePurchaseSourceRelations(string $tenant, array $data): void
    {
        if (! empty($data['linked_company_id']) && ! DB::table('insurance_companies')->where('tenant_id', $tenant)->whereNull('deleted_at')->where('id', $data['linked_company_id'])->exists()) {
            throw ValidationException::withMessages(['linked_company_id' => ['Select an insurance company from this organization.']]);
        }
    }

    private function authorize(Request $request, string $permission): void
    {
        abort_unless($request->user()?->can($permission), 403);
    }

    public function commissions(Request $request)
    {
        $this->authorize($request, 'vehicle.view');
        $rows = DB::table('insurance_commissions as c')
            ->join('insurance_companies as i','i.id','=','c.insurance_company_id')
            ->where('c.tenant_id', $this->tenant($request))->whereColumn('i.tenant_id', 'c.tenant_id')->whereNull('c.deleted_at')
            ->select('c.*','i.company_name')->orderByDesc('c.statement_date')->orderByDesc('c.created_at')->get();
        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function storeCommission(Request $request)
    {
        $this->authorize($request, 'vehicle.create');
        $data = $request->validate([
            'insurance_company_id' => ['required','uuid'], 'statement_number' => ['nullable','string','max:100'],
            'statement_date' => ['required','date'], 'policy_number' => ['nullable','string','max:100'],
            'customer_name' => ['nullable','string','max:200'], 'gross_premium' => ['nullable','numeric','min:0'],
            'commission_percent' => ['required','numeric','min:0','max:100'], 'gross_commission' => ['nullable','numeric','min:0'],
            'tds_percent' => ['required','numeric','min:0','max:100'], 'remarks' => ['nullable','string','max:2000'],
        ]);
        $tenant = $this->tenant($request);
        if (! DB::table('insurance_companies')->where('tenant_id', $tenant)->whereNull('deleted_at')->where('id', $data['insurance_company_id'])->exists()) {
            throw ValidationException::withMessages(['insurance_company_id' => ['Select an insurance company from this organization.']]);
        }
        $grossCommission = (float) ($data['gross_commission'] ?? 0);
        if ($grossCommission <= 0) $grossCommission = round(((float)($data['gross_premium'] ?? 0) * (float)$data['commission_percent']) / 100, 2);
        $tds = round($grossCommission * (float)$data['tds_percent'] / 100, 2);
        $net = round($grossCommission - $tds, 2);
        $id = (string) Str::uuid();
        DB::table('insurance_commissions')->insert(array_merge($data, [
            'id' => $id, 'tenant_id' => $tenant, 'gross_commission' => $grossCommission,
            'tds_amount' => $tds, 'net_receivable' => $net, 'received_amount' => 0, 'status' => 'pending',
            'created_by' => $request->user()?->id, 'updated_by' => $request->user()?->id,
            'created_at' => now(), 'updated_at' => now(),
        ]));
        return response()->json(['success' => true, 'data' => DB::table('insurance_commissions')->where('tenant_id',$tenant)->where('id',$id)->first()], 201);
    }

    public function receiveCommission(Request $request, string $id)
    {
        $this->authorize($request, 'vehicle.update');
        $data = $request->validate([
            'received_amount' => ['required','numeric','min:0'], 'received_date' => ['required','date'],
            'bank_reference' => ['nullable','string','max:150'],
        ]);
        $row = DB::table('insurance_commissions')->where('tenant_id',$this->tenant($request))->where('id',$id)->first();
        abort_unless($row, 404);
        $total = min((float)$row->net_receivable, (float)$row->received_amount + (float)$data['received_amount']);
        DB::table('insurance_commissions')->where('tenant_id',$this->tenant($request))->where('id',$id)->update([
            'received_amount' => $total, 'received_date' => $data['received_date'],
            'bank_reference' => $data['bank_reference'] ?? null,
            'status' => $total >= (float)$row->net_receivable ? 'received' : 'partial',
            'updated_by' => $request->user()?->id, 'updated_at' => now(),
        ]);
        return response()->json(['success'=>true,'data'=>DB::table('insurance_commissions')->where('tenant_id',$this->tenant($request))->where('id',$id)->first()]);
    }

    public function summary(Request $request)
    {
        $this->authorize($request, 'vehicle.view');
        $base = DB::table('insurance_commissions')->where('tenant_id',$this->tenant($request))->whereNull('deleted_at');
        return response()->json(['success'=>true,'data'=>[
            'gross_commission'=>(float)(clone $base)->sum('gross_commission'),
            'tds_receivable'=>(float)(clone $base)->sum('tds_amount'),
            'net_receivable'=>(float)(clone $base)->sum('net_receivable'),
            'received'=>(float)(clone $base)->sum('received_amount'),
            'outstanding'=>(float)(clone $base)->selectRaw('COALESCE(SUM(net_receivable-received_amount),0) as total')->value('total'),
        ]]);
    }
}
