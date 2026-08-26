<?php

namespace App\Features\Accounting\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OtherInsuranceController
{
    private function tenant(Request $request): string
    {
        return (string) ($request->user()?->tenant_id ?? $request->header('X-Tenant-Id'));
    }

    private function line(string $line): string
    {
        abort_unless(in_array($line, ['non_motor','health','life'], true), 404);
        return $line;
    }

    public function index(Request $request, string $line)
    {
        $line = $this->line($line);
        $q = DB::table('other_insurance_policies as p')
            ->leftJoin('customers as c', 'c.id', '=', 'p.customer_id')
            ->where('p.tenant_id', $this->tenant($request))
            ->where('p.insurance_line', $line)
            ->whereNull('p.deleted_at')
            ->select('p.*', 'c.first_name', 'c.middle_name', 'c.last_name', 'c.mobile as customer_mobile');

        if ($request->filled('from')) $q->whereDate('p.issue_date', '>=', $request->input('from'));
        if ($request->filled('to')) $q->whereDate('p.issue_date', '<=', $request->input('to'));
        if ($request->filled('channel')) $q->where('p.business_channel', $request->input('channel'));
        if ($request->filled('search')) {
            $s = '%'.$request->input('search').'%';
            $q->where(fn($x) => $x->where('p.policy_number','ilike',$s)
                ->orWhere('p.customer_name','ilike',$s)->orWhere('p.mobile','ilike',$s)
                ->orWhere('p.company_name','ilike',$s)->orWhere('p.product_type','ilike',$s)
                ->orWhere('c.first_name','ilike',$s)->orWhere('c.mobile','ilike',$s));
        }

        $rows = $q->orderByDesc('p.issue_date')->orderByDesc('p.created_at')->get()->map(function($r){
            $crmName = trim(implode(' ', array_filter([$r->first_name,$r->middle_name,$r->last_name])));
            $name = $r->customer_name ?: ($crmName ?: '—');
            $mobile = $r->mobile ?: $r->customer_mobile;
            $premium = (float)$r->gross_premium;
            $customerPay = (float)($r->customer_pay ?: $premium);
            $received = (float)$r->received_amount;
            $grossCommission = (float)$r->commission_amount;
            $agentCommission = (float)$r->agent_commission;
            return [
                'id'=>$r->id,'insurance_line'=>$r->insurance_line,'business_channel'=>$r->business_channel ?: 'retail',
                'product_type'=>$r->product_type,'customer_id'=>$r->customer_id,'customer_name'=>$name,'mobile'=>$mobile,
                'insurance_company_id'=>$r->insurance_company_id,'company_name'=>$r->company_name,
                'purchase_from_type'=>$r->purchase_from_type,'purchase_source_id'=>$r->purchase_source_id,
                'policy_number'=>$r->policy_number,'proposal_number'=>$r->proposal_number,
                'issue_date'=>$r->issue_date,'expiry_date'=>$r->expiry_date,'sum_insured'=>(float)$r->sum_insured,
                'gross_premium'=>$premium,'customer_pay'=>$customerPay,'received_amount'=>$received,
                'customer_due'=>round(max(0, $customerPay-$received),2),'company_payable'=>(float)$r->company_payable,
                'commission_percent'=>(float)$r->commission_percent,'commission_amount'=>$grossCommission,
                'agent_commission'=>$agentCommission,'net_commission'=>round($grossCommission-$agentCommission,2),
                'payment_status'=>$r->payment_status,'status'=>$r->status,'notes'=>$r->notes,
            ];
        });

        return response()->json(['success'=>true,'data'=>[
            'rows'=>$rows,
            'summary'=>[
                'policy_count'=>$rows->count(),
                'retail_count'=>$rows->where('business_channel','retail')->count(),
                'wholesale_count'=>$rows->where('business_channel','wholesale')->count(),
                'premium'=>round($rows->sum('gross_premium'),2),
                'received'=>round($rows->sum('received_amount'),2),
                'due'=>round($rows->sum('customer_due'),2),
                'company_payable'=>round($rows->sum('company_payable'),2),
                'gross_commission'=>round($rows->sum('commission_amount'),2),
                'agent_commission'=>round($rows->sum('agent_commission'),2),
                'net_commission'=>round($rows->sum('net_commission'),2),
            ],
        ]]);
    }

    public function store(Request $request, string $line)
    {
        $line = $this->line($line);
        $data = $request->validate($this->rules(true));
        $id = (string) Str::uuid();
        $tenant = $this->tenant($request);
        $now = now();
        $values = $this->normalise($tenant, $data, $line);
        DB::transaction(function () use ($request, $id, $tenant, $now, $values) {
            DB::table('other_insurance_policies')->insert([
                'id'=>$id,'tenant_id'=>$tenant,...$values,
                'created_by'=>$request->user()?->id,'updated_by'=>$request->user()?->id,
                'created_at'=>$now,'updated_at'=>$now,
            ]);
            $this->syncCommission($tenant, $id, $request->user()?->id);
        });
        return response()->json(['success'=>true,'data'=>['id'=>$id]],201);
    }

    public function update(Request $request, string $line, string $id)
    {
        $line = $this->line($line);
        $tenant = $this->tenant($request);
        $existing = DB::table('other_insurance_policies')->where('id',$id)->where('tenant_id',$tenant)
            ->where('insurance_line',$line)->whereNull('deleted_at')->first();
        abort_unless($existing,404);
        $data = $request->validate($this->rules(false));
        $merged = array_merge((array)$existing, $data);
        $values = $this->normalise($tenant, $merged, $line);

        DB::transaction(function () use ($request,$tenant,$id,$values) {
            DB::table('other_insurance_policies')->where('id',$id)->where('tenant_id',$tenant)->update(
                $values + ['updated_by'=>$request->user()?->id,'updated_at'=>now()]
            );
            $this->syncCommission($tenant, $id, $request->user()?->id);
        });
        return response()->json(['success'=>true,'data'=>null]);
    }

    public function destroy(Request $request, string $line, string $id)
    {
        $this->line($line);
        $tenant = $this->tenant($request);
        DB::transaction(function () use ($request,$tenant,$id) {
            DB::table('other_insurance_policies')->where('id',$id)->where('tenant_id',$tenant)
                ->update(['deleted_at'=>now(),'updated_by'=>$request->user()?->id,'updated_at'=>now()]);
            DB::table('insurance_commissions')->where('tenant_id',$tenant)->where('policy_id',$id)
                ->whereNull('deleted_at')->update(['deleted_at'=>now(),'updated_by'=>$request->user()?->id,'updated_at'=>now()]);
        });
        return response()->json(['success'=>true,'data'=>null]);
    }

    private function normalise(string $tenant, array $data, string $line): array
    {
        $channel = $data['business_channel'] ?? 'retail';
        $premium = round((float)($data['gross_premium'] ?? 0),2);
        $customerPay = round((float)($data['customer_pay'] ?? $premium),2);
        $received = round((float)($data['received_amount'] ?? 0),2);
        if ($received > $customerPay + 0.01) throw ValidationException::withMessages(['received_amount'=>['Received amount cannot exceed customer payable.']]);

        $companyId = $data['insurance_company_id'] ?? null;
        if (!$companyId && !empty($data['company_name'])) {
            $companyId = DB::table('insurance_companies')->where('tenant_id',$tenant)->whereNull('deleted_at')
                ->whereRaw('LOWER(company_name) = ?', [strtolower(trim((string)$data['company_name']))])->value('id');
        }
        $company = $companyId ? DB::table('insurance_companies')->where('tenant_id',$tenant)->where('id',$companyId)->whereNull('deleted_at')->first() : null;
        if ($companyId && !$company) throw ValidationException::withMessages(['insurance_company_id'=>['Select a valid insurance company.']]);
        $companyName = $company?->company_name ?? ($data['company_name'] ?? null);

        $purchaseType = $data['purchase_from_type'] ?? 'direct_company';
        $purchaseSourceId = $purchaseType === 'agent' ? ($data['purchase_source_id'] ?? null) : null;
        $receivableType = 'insurance_company';
        $receivableId = $companyId;
        if ($purchaseType === 'agent') {
            $source = DB::table('insurance_purchase_sources')->where('tenant_id',$tenant)->where('id',$purchaseSourceId)
                ->where('is_active',true)->whereNull('deleted_at')->first();
            if (!$source) throw ValidationException::withMessages(['purchase_source_id'=>['Select a valid active purchase source.']]);
            $receivableType = 'purchase_source';
            $receivableId = $source->id;
            if (!$companyId && $source->linked_company_id) {
                $companyId = $source->linked_company_id;
                $company = DB::table('insurance_companies')->where('tenant_id',$tenant)->where('id',$companyId)->whereNull('deleted_at')->first();
                $companyName = $company?->company_name ?? $companyName;
            }
        }

        $commissionPercent = round((float)($data['commission_percent'] ?? $company?->default_commission_percent ?? 0),3);
        $commissionAmount = array_key_exists('commission_amount',$data) && $data['commission_amount'] !== null && $data['commission_amount'] !== ''
            ? round((float)$data['commission_amount'],2)
            : round($premium * $commissionPercent / 100,2);
        if ($commissionPercent <= 0 && $premium > 0 && $commissionAmount > 0) $commissionPercent = round($commissionAmount * 100 / $premium,3);
        $agentCommission = round((float)($data['agent_commission'] ?? 0),2);
        if ($agentCommission > $commissionAmount) throw ValidationException::withMessages(['agent_commission'=>['Agent commission cannot exceed gross commission.']]);

        $companyPayable = round((float)($data['company_payable'] ?? $customerPay),2);
        $customerDue = round(max(0,$customerPay-$received),2);
        $paymentStatus = $customerDue <= 0.01 ? 'paid' : ($received > 0 ? 'partial' : 'pending');

        return [
            'customer_id'=>$data['customer_id']??null,'insurance_line'=>$line,'business_channel'=>$channel,
            'product_type'=>$data['product_type']??null,'customer_name'=>$data['customer_name']??null,'mobile'=>$data['mobile']??null,
            'insurance_company_id'=>$companyId,'company_name'=>$companyName,'purchase_from_type'=>$purchaseType,
            'purchase_source_id'=>$purchaseSourceId,'commission_receivable_from_type'=>$receivableType,
            'commission_receivable_from_id'=>$receivableId,'policy_number'=>$data['policy_number']??null,
            'proposal_number'=>$data['proposal_number']??null,'issue_date'=>$data['issue_date']??null,'expiry_date'=>$data['expiry_date']??null,
            'sum_insured'=>$data['sum_insured']??0,'gross_premium'=>$premium,'commission_percent'=>$commissionPercent,
            'commission_amount'=>$commissionAmount,'agent_commission'=>$agentCommission,'customer_pay'=>$customerPay,
            'received_amount'=>$received,'customer_due'=>$customerDue,'company_payable'=>$companyPayable,
            'payment_status'=>$paymentStatus,'status'=>$data['status']??'active','notes'=>$data['notes']??null,
        ];
    }

    private function syncCommission(string $tenant, string $policyId, ?string $actor): void
    {
        $policy = DB::table('other_insurance_policies')->where('tenant_id',$tenant)->where('id',$policyId)->whereNull('deleted_at')->first();
        if (!$policy || !$policy->insurance_company_id) return;
        $company = DB::table('insurance_companies')->where('tenant_id',$tenant)->where('id',$policy->insurance_company_id)->whereNull('deleted_at')->first();
        if (!$company) return;

        $tdsPercent = (float)$company->tds_percent;
        if ($policy->purchase_from_type === 'agent' && $policy->purchase_source_id) {
            $source = DB::table('insurance_purchase_sources')->where('tenant_id',$tenant)->where('id',$policy->purchase_source_id)->whereNull('deleted_at')->first();
            $tdsPercent = $source && $source->tds_applicable ? (float)$source->tds_percent : 0;
        }
        $gross = round((float)$policy->commission_amount,2);
        $tds = round($gross*$tdsPercent/100,2);
        $net = round($gross-$tds,2);
        $existing = DB::table('insurance_commissions')->where('tenant_id',$tenant)->where('policy_id',$policyId)->first();
        $received = min((float)($existing->received_amount ?? 0),max(0,$net));
        $values = [
            'insurance_company_id'=>$policy->insurance_company_id,'statement_date'=>$policy->issue_date ?: now()->toDateString(),
            'policy_number'=>$policy->policy_number,'customer_name'=>$policy->customer_name,'gross_premium'=>$policy->gross_premium,
            'commission_percent'=>$policy->commission_percent,'gross_commission'=>$gross,'tds_percent'=>$tdsPercent,'tds_amount'=>$tds,
            'net_receivable'=>$net,'received_amount'=>$received,'status'=>$received >= $net && $net > 0 ? 'received' : ($received > 0 ? 'partial' : 'pending'),
            'remarks'=>'Auto synced from '.str_replace('_',' ',$policy->insurance_line).' policy ('.($policy->business_channel ?: 'retail').').',
            'updated_by'=>$actor,'updated_at'=>now(),'deleted_at'=>null,
        ];
        if ($existing) {
            DB::table('insurance_commissions')->where('tenant_id',$tenant)->where('id',$existing->id)->update($values + ['policy_id'=>$policyId]);
            return;
        }
        DB::table('insurance_commissions')->insert($values + ['id'=>(string)Str::uuid(),'tenant_id'=>$tenant,'policy_id'=>$policyId,'created_by'=>$actor,'created_at'=>now()]);
    }

    private function rules(bool $creating): array
    {
        return [
            'business_channel'=>'nullable|in:retail,wholesale','customer_id'=>'nullable|uuid','product_type'=>'nullable|string|max:120',
            'customer_name'=>'nullable|string|max:255','mobile'=>'nullable|string|max:20','insurance_company_id'=>'nullable|uuid',
            'company_name'=>'nullable|string|max:255','purchase_from_type'=>'nullable|in:direct_company,agent','purchase_source_id'=>'nullable|uuid',
            'policy_number'=>'nullable|string|max:120','proposal_number'=>'nullable|string|max:120','issue_date'=>'nullable|date','expiry_date'=>'nullable|date',
            'sum_insured'=>'nullable|numeric|min:0','gross_premium'=>($creating?'required':'nullable').'|numeric|min:0',
            'commission_percent'=>'nullable|numeric|min:0|max:100','commission_amount'=>'nullable|numeric|min:0','agent_commission'=>'nullable|numeric|min:0',
            'customer_pay'=>'nullable|numeric|min:0','company_payable'=>'nullable|numeric|min:0','received_amount'=>'nullable|numeric|min:0',
            'status'=>'nullable|string|max:40','notes'=>'nullable|string|max:3000',
        ];
    }
}
