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
        $banks = DB::table('ledgers')->where('tenant_id',$tenant)->whereNull('deleted_at')->where('status','active')->whereIn('ledger_group',['Bank Accounts','Cash-in-Hand'])->orderBy('ledger_name')->get(['id','ledger_name','ledger_group']);
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
        abort_if($policyRow->status==='cancelled',422,'Cancelled policy cannot be paid.');
        $amount = round((float)$data['amount'],2);
        $policyPay = round((float)$policyRow->customer_pay,2);
        abort_if(abs($amount-$policyPay)>0.01,422,'Record the full policy payable here. Partial customer collection belongs in Customer Payment, not Company Payment.');
        abort_if(DB::table('insurance_policy_settlements')->where('tenant_id',$tenant)->where('policy_id',$policy)->whereNull('deleted_at')->exists(),409,'Company payment is already recorded for this policy.');

        $company = DB::table('insurance_companies')->where('tenant_id',$tenant)->where('id',$policyRow->insurance_company_id)->whereNull('deleted_at')->first();
        abort_unless($company && $company->ledger_id,422,'Insurance company ledger is missing. Edit the insurance company master first.');
        $companyLedger = (string)$company->ledger_id;
        $recoverableLedger = DB::table('ledgers')->where('tenant_id',$tenant)->whereNull('deleted_at')->whereRaw("UPPER(ledger_name) = 'INSURANCE PREMIUM RECOVERABLE'")->value('id');
        abort_unless($recoverableLedger,422,'Insurance Premium Recoverable ledger is missing. Run the latest migration once.');

        if ($data['settlement_type']==='office_bank') {
            abort_unless(!empty($data['bank_ledger_id']),422,'Select bank/cash account.');
            abort_unless(DB::table('ledgers')->where('tenant_id',$tenant)->whereNull('deleted_at')->where('id',$data['bank_ledger_id'])->where('status','active')->whereIn('ledger_group',['Bank Accounts','Cash-in-Hand'])->exists(),422,'Select a valid bank/cash account.');
        } else {
            abort_unless(trim((string)($data['party_name']??''))!=='',422,'Enter the customer / party that paid the insurer directly.');
        }

        DB::transaction(function() use($tenant,$vehicle,$policy,$data,$amount,$request,$companyLedger,$recoverableLedger){
            $settlementId=(string)Str::uuid();
            DB::table('insurance_policy_settlements')->insert([
                'id'=>$settlementId,'tenant_id'=>$tenant,'vehicle_id'=>$vehicle,'policy_id'=>$policy,
                'settlement_type'=>$data['settlement_type'],
                'bank_ledger_id'=>$data['settlement_type']==='office_bank'?$data['bank_ledger_id']:null,
                'party_name'=>$data['settlement_type']==='direct_party'?trim((string)$data['party_name']):null,
                'amount'=>$amount,'payment_date'=>$data['payment_date'],'reference_number'=>$data['reference_number']??null,
                'notes'=>$data['notes']??null,'created_by'=>$request->user()?->id,'created_at'=>now(),'updated_at'=>now(),
            ]);

            $voucherId=(string)Str::uuid();
            $creditLedger=$data['settlement_type']==='office_bank'?(string)$data['bank_ledger_id']:(string)$recoverableLedger;
            $narration=$data['settlement_type']==='office_bank'
                ? 'Insurance company premium paid from office bank/cash.'
                : 'Insurance premium paid directly to company by '.trim((string)$data['party_name']).'.';
            DB::table('accounting_vouchers')->insert([
                'id'=>$voucherId,'tenant_id'=>$tenant,'policy_id'=>$policy,
                'voucher_number'=>'INPAY-'.substr(str_replace('-','',$settlementId),0,14),'voucher_type'=>'payment',
                'voucher_date'=>$data['payment_date'],'reference_number'=>'POLICY-SETTLEMENT:'.$policy,
                'narration'=>$narration,'total_debit'=>$amount,'total_credit'=>$amount,'status'=>'posted',
                'created_by'=>$request->user()?->id,'updated_by'=>$request->user()?->id,'created_at'=>now(),'updated_at'=>now(),
            ]);
            foreach ([[$companyLedger,'debit','Insurance company payable settled'],[$creditLedger,'credit',$data['settlement_type']==='office_bank'?'Paid from bank/cash':'Direct party funding adjusted against premium recoverable']] as [$ledger,$entryType,$description]) {
                DB::table('accounting_voucher_entries')->insert([
                    'id'=>(string)Str::uuid(),'tenant_id'=>$tenant,'voucher_id'=>$voucherId,'ledger_id'=>$ledger,
                    'entry_type'=>$entryType,'amount'=>$amount,'description'=>$description,'created_at'=>now(),'updated_at'=>now(),
                ]);
            }

            $payment = DB::table('vehicle_payments')->where('tenant_id',$tenant)->where('policy_id',$policy)->whereNull('deleted_at')->first();
            if ($payment && $data['settlement_type']==='direct_party') {
                DB::table('vehicle_payments')->where('id',$payment->id)->update([
                    'paid_amount'=>$amount,'status'=>'paid','party_name'=>trim((string)$data['party_name']),
                    'account'=>'Paid directly to insurance company',
                    'notes'=>trim(($payment->notes? $payment->notes."\n":'').'Premium paid directly to company by '.trim((string)$data['party_name'])),
                    'updated_by'=>$request->user()?->id,'updated_at'=>now(),
                ]);
            }

            DB::table('vehicle_timeline_events')->insert([
                'id'=>(string)Str::uuid(),'tenant_id'=>$tenant,'vehicle_id'=>$vehicle,'actor_id'=>$request->user()?->id,
                'event_type'=>'insurance.policy.settlement','title'=>'Insurance company payment completed',
                'description'=>$narration,'metadata'=>json_encode(['policy_id'=>$policy,'amount'=>$amount,'settlement_type'=>$data['settlement_type']]),
                'created_at'=>now(),'updated_at'=>now(),
            ]);
        });

        return $this->show($request,$vehicle,$policy);
    }
}
