<?php

namespace App\Features\Accounting\Controllers;

use App\Features\Accounting\Models\Ledger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InsuranceAccountingController
{
    private function tenant(Request $request): string
    {
        return (string) ($request->user()?->tenant_id ?? $request->header('X-Tenant-Id'));
    }

    public function companies(Request $request)
    {
        return response()->json(['success' => true, 'data' => DB::table('insurance_companies')
            ->where('tenant_id', $this->tenant($request))->whereNull('deleted_at')->orderBy('company_name')->get()]);
    }

    public function storeCompany(Request $request)
    {
        $data = $request->validate([
            'company_name' => ['required','string','max:200'],
            'short_code' => ['nullable','string','max:30'],
            'default_commission_percent' => ['required','numeric','min:0','max:100'],
            'tds_percent' => ['required','numeric','min:0','max:100'],
            'settlement_days' => ['required','integer','min:0'],
            'gst_number' => ['nullable','string','max:32'],
            'pan_number' => ['nullable','string','max:20'],
            'contact_person' => ['nullable','string','max:200'],
            'mobile' => ['nullable','string','max:20'],
            'email' => ['nullable','email','max:255'],
        ]);

        $tenant = $this->tenant($request);
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
            return DB::table('insurance_companies')->where('id', $id)->first();
        });
        return response()->json(['success' => true, 'data' => $company], 201);
    }

    public function commissions(Request $request)
    {
        $rows = DB::table('insurance_commissions as c')
            ->join('insurance_companies as i','i.id','=','c.insurance_company_id')
            ->where('c.tenant_id', $this->tenant($request))->whereNull('c.deleted_at')
            ->select('c.*','i.company_name')->orderByDesc('c.statement_date')->orderByDesc('c.created_at')->get();
        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function storeCommission(Request $request)
    {
        $data = $request->validate([
            'insurance_company_id' => ['required','uuid'], 'statement_number' => ['nullable','string','max:100'],
            'statement_date' => ['required','date'], 'policy_number' => ['nullable','string','max:100'],
            'customer_name' => ['nullable','string','max:200'], 'gross_premium' => ['nullable','numeric','min:0'],
            'commission_percent' => ['required','numeric','min:0','max:100'], 'gross_commission' => ['nullable','numeric','min:0'],
            'tds_percent' => ['required','numeric','min:0','max:100'], 'remarks' => ['nullable','string','max:2000'],
        ]);
        $grossCommission = (float) ($data['gross_commission'] ?? 0);
        if ($grossCommission <= 0) $grossCommission = round(((float)($data['gross_premium'] ?? 0) * (float)$data['commission_percent']) / 100, 2);
        $tds = round($grossCommission * (float)$data['tds_percent'] / 100, 2);
        $net = round($grossCommission - $tds, 2);
        $id = (string) Str::uuid();
        DB::table('insurance_commissions')->insert(array_merge($data, [
            'id' => $id, 'tenant_id' => $this->tenant($request), 'gross_commission' => $grossCommission,
            'tds_amount' => $tds, 'net_receivable' => $net, 'received_amount' => 0, 'status' => 'pending',
            'created_by' => $request->user()?->id, 'updated_by' => $request->user()?->id,
            'created_at' => now(), 'updated_at' => now(),
        ]));
        return response()->json(['success' => true, 'data' => DB::table('insurance_commissions')->where('id',$id)->first()], 201);
    }

    public function receiveCommission(Request $request, string $id)
    {
        $data = $request->validate([
            'received_amount' => ['required','numeric','min:0'], 'received_date' => ['required','date'],
            'bank_reference' => ['nullable','string','max:150'],
        ]);
        $row = DB::table('insurance_commissions')->where('tenant_id',$this->tenant($request))->where('id',$id)->first();
        abort_unless($row, 404);
        $total = min((float)$row->net_receivable, (float)$row->received_amount + (float)$data['received_amount']);
        DB::table('insurance_commissions')->where('id',$id)->update([
            'received_amount' => $total, 'received_date' => $data['received_date'],
            'bank_reference' => $data['bank_reference'] ?? null,
            'status' => $total >= (float)$row->net_receivable ? 'received' : 'partial',
            'updated_by' => $request->user()?->id, 'updated_at' => now(),
        ]);
        return response()->json(['success'=>true,'data'=>DB::table('insurance_commissions')->where('id',$id)->first()]);
    }

    public function summary(Request $request)
    {
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
