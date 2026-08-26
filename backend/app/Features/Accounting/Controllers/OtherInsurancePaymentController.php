<?php

namespace App\Features\Accounting\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OtherInsurancePaymentController
{
    private function tenant(Request $request): string
    {
        return (string) ($request->user()?->tenant_id ?? $request->header('X-Tenant-Id'));
    }

    public function index(Request $request)
    {
        abort_unless($request->user()?->can('vehicle.view'), 403);
        $tenant = $this->tenant($request);

        $rows = DB::table('other_insurance_policies as p')
            ->leftJoin('customers as c', function ($join) {
                $join->on('c.id', '=', 'p.customer_id')->on('c.tenant_id', '=', 'p.tenant_id');
            })
            ->leftJoin('insurance_purchase_sources as s', function ($join) {
                $join->on('s.id', '=', 'p.purchase_source_id')->on('s.tenant_id', '=', 'p.tenant_id');
            })
            ->where('p.tenant_id', $tenant)
            ->whereNull('p.deleted_at')
            ->where('p.status', '<>', 'cancelled')
            ->where('p.company_payable', '>', 0.009)
            ->select([
                'p.id','p.insurance_line','p.business_channel','p.policy_number','p.product_type','p.company_name',
                'p.purchase_from_type','p.purchase_source_id','p.customer_name','p.mobile','p.company_payable','p.issue_date','p.expiry_date',
                'c.first_name','c.last_name','c.mobile as crm_mobile','s.name as purchase_source_name',
            ])
            ->orderByDesc('p.issue_date')->orderByDesc('p.created_at')->get()->map(function ($row) use ($tenant) {
                $paid = (float) DB::table('other_insurance_company_payments')
                    ->where('tenant_id', $tenant)->where('policy_id', $row->id)->whereNull('deleted_at')->sum('amount');
                $crmName = trim(($row->first_name ?? '').' '.($row->last_name ?? ''));
                return [
                    'id' => $row->id,
                    'insurance_line' => $row->insurance_line,
                    'business_channel' => $row->business_channel ?: 'retail',
                    'policy_number' => $row->policy_number,
                    'product_type' => $row->product_type,
                    'company_name' => $row->company_name,
                    'purchase_from_type' => $row->purchase_from_type,
                    'purchase_source_name' => $row->purchase_source_name,
                    'customer_name' => $row->customer_name ?: ($crmName ?: 'Customer'),
                    'mobile' => $row->mobile ?: $row->crm_mobile,
                    'remaining_payable' => (float) $row->company_payable,
                    'paid_to_date' => $paid,
                    'issue_date' => $row->issue_date,
                    'expiry_date' => $row->expiry_date,
                ];
            });

        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function history(Request $request, string $policy)
    {
        abort_unless($request->user()?->can('vehicle.view'), 403);
        $tenant = $this->tenant($request);
        abort_unless(DB::table('other_insurance_policies')->where('tenant_id',$tenant)->where('id',$policy)->whereNull('deleted_at')->exists(), 404);
        $rows = DB::table('other_insurance_company_payments')->where('tenant_id',$tenant)->where('policy_id',$policy)
            ->whereNull('deleted_at')->orderByDesc('payment_date')->orderByDesc('created_at')->get();
        return response()->json(['success'=>true,'data'=>$rows]);
    }

    public function store(Request $request, string $policy)
    {
        abort_unless($request->user()?->can('vehicle.update'), 403);
        $tenant = $this->tenant($request);
        $data = $request->validate([
            'amount' => ['required','numeric','gt:0'],
            'payment_date' => ['required','date'],
            'payment_mode' => ['required','in:office_bank,direct_party,other'],
            'bank_ledger_id' => ['nullable','uuid'],
            'paid_to' => ['nullable','string','max:200'],
            'reference_number' => ['nullable','string','max:150'],
            'notes' => ['nullable','string','max:1500'],
        ]);

        $row = DB::table('other_insurance_policies')->where('tenant_id',$tenant)->where('id',$policy)->whereNull('deleted_at')->lockForUpdate()->first();
        abort_unless($row, 404);
        abort_if($row->status === 'cancelled', 422, 'Cancelled policy cannot be paid.');
        $remaining = round((float)$row->company_payable, 2);
        $amount = round((float)$data['amount'], 2);
        abort_if($amount > $remaining + 0.01, 422, 'Payment cannot exceed remaining company/source payable.');

        if ($data['payment_mode'] === 'office_bank' && !empty($data['bank_ledger_id'])) {
            abort_unless(DB::table('ledgers')->where('tenant_id',$tenant)->where('id',$data['bank_ledger_id'])
                ->whereNull('deleted_at')->where('status','active')->exists(), 422, 'Select a valid bank/cash ledger.');
        }

        $payment = DB::transaction(function () use ($request,$tenant,$policy,$row,$data,$remaining,$amount) {
            $id = (string) Str::uuid();
            DB::table('other_insurance_company_payments')->insert([
                'id'=>$id,'tenant_id'=>$tenant,'policy_id'=>$policy,'amount'=>$amount,
                'payment_date'=>$data['payment_date'],'payment_mode'=>$data['payment_mode'],
                'bank_ledger_id'=>$data['bank_ledger_id']??null,'paid_to'=>$data['paid_to']??null,
                'reference_number'=>$data['reference_number']??null,'notes'=>$data['notes']??null,
                'created_by'=>$request->user()?->id,'created_at'=>now(),'updated_at'=>now(),
            ]);
            $newRemaining = round(max(0, $remaining - $amount), 2);
            DB::table('other_insurance_policies')->where('tenant_id',$tenant)->where('id',$policy)->update([
                'company_payable'=>$newRemaining,'updated_by'=>$request->user()?->id,'updated_at'=>now(),
            ]);
            return DB::table('other_insurance_company_payments')->where('tenant_id',$tenant)->where('id',$id)->first();
        });

        return response()->json(['success'=>true,'message'=>'Company/source payment recorded.','data'=>$payment], 201);
    }
}
