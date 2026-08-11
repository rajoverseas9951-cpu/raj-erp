<?php

namespace App\Features\Accounting\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
            $received = (float)$r->received_amount;
            $grossCommission = (float)$r->commission_amount;
            $agentCommission = (float)$r->agent_commission;
            return [
                'id'=>$r->id,'insurance_line'=>$r->insurance_line,'product_type'=>$r->product_type,
                'customer_id'=>$r->customer_id,'customer_name'=>$name,'mobile'=>$mobile,
                'company_name'=>$r->company_name,'policy_number'=>$r->policy_number,'proposal_number'=>$r->proposal_number,
                'issue_date'=>$r->issue_date,'expiry_date'=>$r->expiry_date,'sum_insured'=>(float)$r->sum_insured,
                'gross_premium'=>$premium,'commission_amount'=>$grossCommission,'agent_commission'=>$agentCommission,
                'net_commission'=>round($grossCommission-$agentCommission,2),'received_amount'=>$received,
                'due_amount'=>round(max(0,$premium-$received),2),'status'=>$r->status,'notes'=>$r->notes,
            ];
        });

        return response()->json(['success'=>true,'data'=>[
            'rows'=>$rows,
            'summary'=>[
                'policy_count'=>$rows->count(),
                'premium'=>round($rows->sum('gross_premium'),2),
                'received'=>round($rows->sum('received_amount'),2),
                'due'=>round($rows->sum('due_amount'),2),
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
        $id = (string) Str::uuid(); $now = now();
        DB::table('other_insurance_policies')->insert([
            'id'=>$id,'tenant_id'=>$this->tenant($request),'customer_id'=>$data['customer_id']??null,'insurance_line'=>$line,
            'product_type'=>$data['product_type']??null,'customer_name'=>$data['customer_name']??null,'mobile'=>$data['mobile']??null,
            'company_name'=>$data['company_name']??null,'policy_number'=>$data['policy_number']??null,'proposal_number'=>$data['proposal_number']??null,
            'issue_date'=>$data['issue_date']??null,'expiry_date'=>$data['expiry_date']??null,'sum_insured'=>$data['sum_insured']??0,
            'gross_premium'=>$data['gross_premium'],'commission_amount'=>$data['commission_amount']??0,'agent_commission'=>$data['agent_commission']??0,
            'received_amount'=>$data['received_amount']??0,'status'=>$data['status']??'active','notes'=>$data['notes']??null,
            'created_by'=>$request->user()?->id,'created_at'=>$now,'updated_at'=>$now,
        ]);
        return response()->json(['success'=>true,'data'=>['id'=>$id]],201);
    }

    public function update(Request $request, string $line, string $id)
    {
        $this->line($line);
        $data=$request->validate($this->rules(false));
        $data['updated_at']=now();
        DB::table('other_insurance_policies')->where('id',$id)->where('tenant_id',$this->tenant($request))->where('insurance_line',$line)->whereNull('deleted_at')->update($data);
        return response()->json(['success'=>true,'data'=>null]);
    }

    public function destroy(Request $request, string $line, string $id)
    {
        $this->line($line);
        DB::table('other_insurance_policies')->where('id',$id)->where('tenant_id',$this->tenant($request))->where('insurance_line',$line)->update(['deleted_at'=>now(),'updated_at'=>now()]);
        return response()->json(['success'=>true,'data'=>null]);
    }

    private function rules(bool $creating): array
    {
        return [
            'customer_id'=>'nullable|uuid','product_type'=>'nullable|string|max:120','customer_name'=>'nullable|string|max:255','mobile'=>'nullable|string|max:20',
            'company_name'=>'nullable|string|max:255','policy_number'=>'nullable|string|max:120','proposal_number'=>'nullable|string|max:120',
            'issue_date'=>'nullable|date','expiry_date'=>'nullable|date','sum_insured'=>'nullable|numeric|min:0',
            'gross_premium'=>($creating?'required':'nullable').'|numeric|min:0','commission_amount'=>'nullable|numeric|min:0','agent_commission'=>'nullable|numeric|min:0',
            'received_amount'=>'nullable|numeric|min:0','status'=>'nullable|string|max:40','notes'=>'nullable|string|max:3000',
        ];
    }
}
