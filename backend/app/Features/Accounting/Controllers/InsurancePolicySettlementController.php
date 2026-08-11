<?php

namespace App\Features\Accounting\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class InsurancePolicySettlementController
{
    public function show(Request $request, string $vehicle, string $policy)
    {
        $tenant = (string) $request->user()?->tenant_id;
        $row = DB::table('vehicle_insurances')->where('tenant_id',$tenant)->where('vehicle_id',$vehicle)->where('id',$policy)->whereNull('deleted_at')->first();
        abort_unless($row,404);
        $settlement = Schema::hasTable('insurance_policy_settlements')
            ? DB::table('insurance_policy_settlements')->where('tenant_id',$tenant)->where('policy_id',$policy)->whereNull('deleted_at')->first()
            : null;
        $banks = DB::table('ledgers')->where('tenant_id',$tenant)->where('status','active')->whereIn('ledger_group',['Bank Accounts','Cash-in-Hand'])->orderBy('ledger_name')->get(['id','ledger_name','ledger_group']);
        return response()->json(['success'=>true,'data'=>['policy'=>$row,'settlement'=>$settlement,'banks'=>$banks]]);
    }

    public function store(Request $request, string $vehicle, string $policy)
    {
        $tenant = (string) $request->user()?->tenant_id;
        $data = $request->validate([
            'settlement_type'=>['required','in:office_bank,direct_party'],
            'bank_ledger_id'=>['nullable','uuid'],
            'party_name'=>['nullable','string','max:160'],
            'amount'=>['required','numeric','gt:0'],
            'payment_date'=>['required','date'],
            'reference_number'=>['nullable','string','max:120'],
            'notes'=>['nullable','string','max:1000'],
        ]);
        $policyRow = DB::table('vehicle_insurances')->where('tenant_id',$tenant)->where('vehicle_id',$vehicle)->where('id',$policy)->whereNull('deleted_at')->first();
        abort_unless($policyRow,404);
        $amount = round((float)$data['amount'],2);
        abort_if($amount > round((float)$policyRow->customer_pay,2) + 0.01,422,'Settlement amount cannot exceed customer payable premium.');

        if ($data['settlement_type']==='office_bank') {
            abort_unless(!empty($data['bank_ledger_id']),422,'Select bank/cash account.');
            abort_unless(DB::table('ledgers')->where('tenant_id',$tenant)->where('id',$data['bank_ledger_id'])->where('status','active')->whereIn('ledger_group',['Bank Accounts','Cash-in-Hand'])->exists(),422,'Select a valid bank/cash account.');
        } else {
            abort_unless(trim((string)($data['party_name']??''))!=='',422,'Select or enter the party that paid the company directly.');
        }

        $id = (string) Str::uuid();
        DB::transaction(function() use($tenant,$vehicle,$policy,$policyRow,$data,$amount,$id,$request){
            $existing = DB::table('insurance_policy_settlements')->where('tenant_id',$tenant)->where('policy_id',$policy)->first();
            $values = [
                'vehicle_id'=>$vehicle,'settlement_type'=>$data['settlement_type'],
                'bank_ledger_id'=>$data['settlement_type']==='office_bank'?$data['bank_ledger_id']:null,
                'party_name'=>$data['settlement_type']==='direct_party'?trim((string)$data['party_name']):null,
                'amount'=>$amount,'payment_date'=>$data['payment_date'],'reference_number'=>$data['reference_number']??null,
                'notes'=>$data['notes']??null,'deleted_at'=>null,'updated_at'=>now(),
            ];
            if ($existing) DB::table('insurance_policy_settlements')->where('id',$existing->id)->update($values);
            else DB::table('insurance_policy_settlements')->insert($values+['id'=>$id,'tenant_id'=>$tenant,'policy_id'=>$policy,'created_by'=>$request->user()?->id,'created_at'=>now()]);

            $payment = DB::table('vehicle_payments')->where('tenant_id',$tenant)->where('policy_id',$policy)->whereNull('deleted_at')->first();
            if ($payment && $data['settlement_type']==='direct_party') {
                DB::table('vehicle_payments')->where('id',$payment->id)->update([
                    'paid_amount'=>$amount,
                    'status'=>$amount+0.01 >= (float)$payment->billed_amount?'paid':'partial',
                    'party_name'=>trim((string)$data['party_name']),
                    'account'=>'Paid directly to insurance company',
                    'notes'=>trim(($payment->notes? $payment->notes."\n":'').'Premium paid directly to company by '.trim((string)$data['party_name'])),
                    'updated_by'=>$request->user()?->id,'updated_at'=>now(),
                ]);
            }

            DB::table('vehicle_timeline_events')->insert([
                'id'=>(string)Str::uuid(),'tenant_id'=>$tenant,'vehicle_id'=>$vehicle,'actor_id'=>$request->user()?->id,
                'event_type'=>'insurance.policy.settlement','title'=>'Insurance premium funding recorded',
                'description'=>$data['settlement_type']==='office_bank'?'Premium paid to company from office bank/cash.':'Premium paid directly to company by party.',
                'metadata'=>json_encode(['policy_id'=>$policy,'amount'=>$amount,'settlement_type'=>$data['settlement_type']]),
                'created_at'=>now(),'updated_at'=>now(),
            ]);
        });

        return $this->show($request,$vehicle,$policy);
    }
}
