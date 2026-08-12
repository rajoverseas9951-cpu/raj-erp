<?php

namespace App\Features\Accounting\Controllers;

use App\Support\SimplePdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinanceControlController
{
    private function tenant(Request $request): string { return (string) ($request->user()?->tenant_id ?? $request->header('X-Tenant-Id')); }

    public function simpleEntry(Request $request)
    {
        $data=$request->validate(['entry_type'=>['required','in:received,paid,expense'],'date'=>['required','date'],'amount'=>['required','numeric','gt:0'],'cash_bank_ledger_id'=>['required','uuid'],'other_ledger_id'=>['required','uuid','different:cash_bank_ledger_id'],'reference_number'=>['nullable','string','max:100'],'notes'=>['nullable','string','max:1000']]);
        $tenant=$this->tenant($request); $this->ensureYear($tenant,$data['date']); $this->assertYearOpen($tenant,$data['date']);
        $ledgers=DB::table('accounting_ledgers')->where('tenant_id',$tenant)->whereIn('id',[$data['cash_bank_ledger_id'],$data['other_ledger_id']])->get()->keyBy('id');
        if($ledgers->count()!==2) throw ValidationException::withMessages(['ledger'=>['Select valid account heads.']]);
        $cash=$ledgers[$data['cash_bank_ledger_id']]; if(!in_array($cash->ledger_group,['Cash-in-Hand','Bank Accounts'],true)) throw ValidationException::withMessages(['cash_bank_ledger_id'=>['Select a Cash or Bank account.']]);
        $voucherType=$data['entry_type']==='received'?'receipt':'payment'; $id=(string)Str::uuid(); $amount=round((float)$data['amount'],2); $number=strtoupper(substr($voucherType,0,3)).'-'.now()->format('YmdHis').'-'.random_int(100,999);
        DB::transaction(function() use($tenant,$request,$data,$id,$amount,$number,$voucherType){DB::table('accounting_vouchers')->insert(['id'=>$id,'tenant_id'=>$tenant,'voucher_number'=>$number,'voucher_type'=>$voucherType,'voucher_date'=>$data['date'],'reference_number'=>$data['reference_number']??null,'narration'=>$data['notes']??ucfirst($data['entry_type']).' entry','total_debit'=>$amount,'total_credit'=>$amount,'status'=>'posted','created_by'=>$request->user()?->id,'updated_by'=>$request->user()?->id,'created_at'=>now(),'updated_at'=>now()]);$debit=$data['entry_type']==='received'?$data['cash_bank_ledger_id']:$data['other_ledger_id'];$credit=$data['entry_type']==='received'?$data['other_ledger_id']:$data['cash_bank_ledger_id'];foreach([[$debit,'debit'],[$credit,'credit']] as [$ledgerId,$type]) DB::table('accounting_voucher_entries')->insert(['id'=>(string)Str::uuid(),'tenant_id'=>$tenant,'voucher_id'=>$id,'ledger_id'=>$ledgerId,'entry_type'=>$type,'amount'=>$amount,'description'=>$data['notes']??null,'created_at'=>now(),'updated_at'=>now()]);});
        return response()->json(['success'=>true,'data'=>['id'=>$id,'voucher_number'=>$number]]);
    }

    public function outstanding(Request $request){return response()->json(['success'=>true,'data'=>$this->outstandingPayload($this->tenant($request))]);}

    public function outstandingExport(Request $request): StreamedResponse
    {
        $type=$request->query('type','receivable'); abort_unless(in_array($type,['receivable','payable'],true),422,'Invalid outstanding report type.'); $payload=$this->outstandingPayload($this->tenant($request)); $amountKey=$type==='receivable'?'receivable':'payable'; $title=$type==='receivable'?'Customer / Party Receivable Report':'Party Payable Report'; $rows=[];
        foreach($payload['rows'] as $row){if((float)$row[$amountKey]<=0)continue;$rows[]=[$row['name'],$row['group'],'Rs. '.number_format((float)$row[$amountKey],2)];}
        $total=array_sum(array_map(fn($row)=>(float)$row[$amountKey],$payload['rows'])); $rows[]=['','','']; $rows[]=['TOTAL','', 'Rs. '.number_format($total,2)]; $pdf=SimplePdf::document($title,['Party','Type',$type==='receivable'?'To Receive':'To Pay'],$rows); $filename=$type==='receivable'?'customer-party-receivable.pdf':'party-payable.pdf'; return response()->streamDownload(fn()=>print($pdf),$filename,['Content-Type'=>'application/pdf']);
    }

    private function outstandingPayload(string $tenant): array
    {
        $rows=collect();
        $ledgerReceivable=0.0;

        if(Schema::hasTable('accounting_ledgers')){
            $ledgers=DB::table('accounting_ledgers')->where('tenant_id',$tenant)->whereIn('ledger_group',['Sundry Debtors','Sundry Creditors'])->orderBy('ledger_name')->get(); $movements=collect();
            if(Schema::hasTable('accounting_voucher_entries')&&Schema::hasTable('accounting_vouchers')) $movements=DB::table('accounting_voucher_entries as e')->join('accounting_vouchers as v','v.id','=','e.voucher_id')->where('e.tenant_id',$tenant)->where('v.status','posted')->select('e.ledger_id',DB::raw("SUM(CASE WHEN e.entry_type='debit' THEN e.amount ELSE 0 END) debit"),DB::raw("SUM(CASE WHEN e.entry_type='credit' THEN e.amount ELSE 0 END) credit"))->groupBy('e.ledger_id')->get()->keyBy('ledger_id');
            $rows=$ledgers->map(function($l) use($movements){$m=$movements->get($l->id);$opening=(float)($l->opening_balance??0)*(($l->balance_type??'debit')==='debit'?1:-1);$balance=$opening+(float)($m->debit??0)-(float)($m->credit??0);return ['id'=>$l->id,'name'=>$l->ledger_name,'group'=>$l->ledger_group,'receivable'=>$balance>0?round($balance,2):0,'payable'=>$balance<0?round(abs($balance),2):0];})->filter(fn($r)=>$r['receivable']>0||$r['payable']>0)->values();
            $ledgerReceivable=(float)$rows->sum('receivable');
        }

        // Operational customer receivable is driven by actual billed-vs-received vehicle work.
        // This includes unpaid insurance premium billed to the customer. Insurance commission is NOT included here.
        $customerReceivable=0.0;
        if(Schema::hasTable('vehicle_payments')&&Schema::hasColumn('vehicle_payments','billed_amount')&&Schema::hasColumn('vehicle_payments','paid_amount')){
            $q=DB::table('vehicle_payments as p')->join('vehicles as v',function($join){$join->on('v.id','=','p.vehicle_id')->on('v.tenant_id','=','p.tenant_id');})->where('p.tenant_id',$tenant);
            if(Schema::hasColumn('vehicle_payments','deleted_at'))$q->whereNull('p.deleted_at');
            if(Schema::hasColumn('vehicles','deleted_at'))$q->whereNull('v.deleted_at');
            if(Schema::hasTable('customers'))$q->leftJoin('customers as c',function($join){$join->on('c.id','=','v.customer_id')->on('c.tenant_id','=','v.tenant_id');});
            $select=['p.id','p.vehicle_id','p.billed_amount','p.paid_amount'];
            if(Schema::hasColumn('vehicle_payments','party_name'))$select[]='p.party_name';
            if(Schema::hasColumn('vehicle_payments','purpose'))$select[]='p.purpose';
            if(Schema::hasColumn('vehicles','registration_number'))$select[]='v.registration_number';
            elseif(Schema::hasColumn('vehicles','registration_no'))$select[]='v.registration_no';
            if(Schema::hasTable('customers')){
                foreach(['first_name','middle_name','last_name','company_name'] as $column)if(Schema::hasColumn('customers',$column))$select[]='c.'.$column;
            }
            $payments=$q->get($select); $pending=[];
            foreach($payments as $payment){
                $due=max(0,round((float)($payment->billed_amount??0)-(float)($payment->paid_amount??0),2)); if($due<=0)continue;
                $party=trim((string)($payment->party_name??''));
                if($party===''){
                    $customerParts=[]; foreach(['first_name','middle_name','last_name'] as $field){$value=trim((string)($payment->{$field}??'')); if($value!=='')$customerParts[]=$value;}
                    $party=trim(implode(' ',$customerParts)); if($party==='')$party=trim((string)($payment->company_name??''));
                }
                $registration=trim((string)($payment->registration_number??$payment->registration_no??''));
                if($party==='')$party=$registration!==''?'Vehicle '.$registration:'Customer';
                $key=strtolower($party); if(!isset($pending[$key]))$pending[$key]=['id'=>'customer-receivable-'.md5($key),'name'=>$party,'group'=>'Customer Receivable','receivable'=>0,'payable'=>0];
                $pending[$key]['receivable']=round($pending[$key]['receivable']+$due,2); $customerReceivable=round($customerReceivable+$due,2);
            }
            foreach($pending as $row)$rows->push($row);
        }

        // A saved policy creates an operational liability to the insurer/purchase source until company funding is recorded.
        // This is intentionally separate from customer recovery and from commission receivable.
        if(Schema::hasTable('vehicle_insurances')){
            $settlements=collect();
            if(Schema::hasTable('insurance_policy_settlements')) $settlements=DB::table('insurance_policy_settlements')->where('tenant_id',$tenant)->whereNull('deleted_at')->get()->keyBy('policy_id');
            $policies=DB::table('vehicle_insurances')->where('tenant_id',$tenant)->whereNull('deleted_at')->whereNull('archived_at')->whereNotIn('status',['cancelled','expired'])->get();
            $pending=[];
            foreach($policies as $policy){
                $settled=(float)($settlements->get($policy->id)?->amount??0); $due=max(0,round((float)$policy->customer_pay-$settled,2)); if($due<=0)continue;
                $party=trim((string)(($policy->purchase_from_type??'direct_company')==='agent'&&trim((string)($policy->purchase_from??''))!==''?$policy->purchase_from:$policy->company_name)); if($party==='')$party='INSURANCE COMPANY';
                $key=strtolower($party); if(!isset($pending[$key]))$pending[$key]=['id'=>'insurance-payable-'.$key,'name'=>$party,'group'=>'Insurance Premium Payable','receivable'=>0,'payable'=>0]; $pending[$key]['payable']=round($pending[$key]['payable']+$due,2);
            }
            foreach($pending as $row)$rows->push($row);
        }

        // Commission due is kept completely separate from customer receivable: it is money due from insurer/source to the agency.
        $insuranceDue=0.0; if(Schema::hasTable('insurance_commissions')&&Schema::hasColumn('insurance_commissions','net_receivable')){$q=DB::table('insurance_commissions')->where('tenant_id',$tenant);if(Schema::hasColumn('insurance_commissions','deleted_at'))$q->whereNull('deleted_at');if(Schema::hasColumn('insurance_commissions','received_amount'))$insuranceDue=(float)($q->selectRaw('COALESCE(SUM(CASE WHEN COALESCE(net_receivable,0)-COALESCE(received_amount,0)>0 THEN COALESCE(net_receivable,0)-COALESCE(received_amount,0) ELSE 0 END),0) total')->value('total')??0);else$insuranceDue=(float)($q->sum('net_receivable')??0);}
        $serviceDue=0.0; if(Schema::hasTable('service_works')&&Schema::hasColumn('service_works','amount')){$q=DB::table('service_works')->where('tenant_id',$tenant);if(Schema::hasColumn('service_works','deleted_at'))$q->whereNull('deleted_at');if(Schema::hasColumn('service_works','received_amount'))$serviceDue=(float)($q->selectRaw('COALESCE(SUM(CASE WHEN COALESCE(amount,0)-COALESCE(received_amount,0)>0 THEN COALESCE(amount,0)-COALESCE(received_amount,0) ELSE 0 END),0) total')->value('total')??0);}

        $payable=(float)$rows->sum('payable');
        return ['rows'=>$rows->values(),'summary'=>[
            'customer_receivable'=>round($customerReceivable,2),
            'ledger_receivable'=>round($ledgerReceivable,2),
            'total_receivable'=>round($customerReceivable+$ledgerReceivable,2),
            'party_receivable'=>round($ledgerReceivable,2),
            'party_payable'=>round($payable,2),
            'insurance_commission_due'=>round($insuranceDue,2),
            'service_customer_due'=>round($serviceDue,2),
        ]];
    }

    public function openingBalances(Request $request){$rows=DB::table('accounting_ledgers')->where('tenant_id',$this->tenant($request))->orderBy('ledger_name')->get(['id','ledger_name','ledger_group','opening_balance','balance_type']);return response()->json(['success'=>true,'data'=>$rows]);}
    public function updateOpeningBalance(Request $request,string $ledgerId){$data=$request->validate(['opening_balance'=>['required','numeric','min:0'],'balance_type'=>['required','in:debit,credit'],'fy_start'=>['nullable','date']]);$tenant=$this->tenant($request);if(!empty($data['fy_start']))$this->assertYearOpen($tenant,$data['fy_start']);DB::table('accounting_ledgers')->where('tenant_id',$tenant)->where('id',$ledgerId)->update(['opening_balance'=>round((float)$data['opening_balance'],2),'balance_type'=>$data['balance_type'],'updated_at'=>now()]);return response()->json(['success'=>true,'data'=>null]);}
    public function yearStatus(Request $request){[$start,$end]=$this->fyDates($request->input('fy_start'));$tenant=$this->tenant($request);$this->ensureYear($tenant,$start);$row=DB::table('financial_year_locks')->where('tenant_id',$tenant)->where('fy_start',$start)->where('fy_end',$end)->first();return response()->json(['success'=>true,'data'=>['fy_start'=>$start,'fy_end'=>$end,'label'=>substr($start,0,4).'-'.substr($end,2,2),'automatic'=>true,'locked'=>(bool)($row?->locked_at),'locked_at'=>$row?->locked_at]]);}
    public function lockYear(Request $request){$data=$request->validate(['fy_start'=>['required','date'],'confirm'=>['accepted']]);[$start,$end]=$this->fyDates($data['fy_start']);$tenant=$this->tenant($request);$this->ensureYear($tenant,$start);DB::table('financial_year_locks')->where('tenant_id',$tenant)->where('fy_start',$start)->where('fy_end',$end)->update(['locked_at'=>now(),'locked_by'=>$request->user()?->id,'unlocked_at'=>null,'unlocked_by'=>null,'updated_at'=>now()]);return response()->json(['success'=>true,'data'=>['fy_start'=>$start,'fy_end'=>$end,'locked'=>true]]);}
    public function unlockYear(Request $request){$data=$request->validate(['fy_start'=>['required','date'],'confirm'=>['accepted']]);[$start,$end]=$this->fyDates($data['fy_start']);DB::table('financial_year_locks')->where('tenant_id',$this->tenant($request))->where('fy_start',$start)->where('fy_end',$end)->update(['locked_at'=>null,'unlocked_at'=>now(),'unlocked_by'=>$request->user()?->id,'updated_at'=>now()]);return response()->json(['success'=>true,'data'=>['fy_start'=>$start,'fy_end'=>$end,'locked'=>false]]);}
    private function ensureYear(string $tenant,string $date): void{if(!Schema::hasTable('financial_year_locks'))return;[$start,$end]=$this->fyDates($date);$exists=DB::table('financial_year_locks')->where('tenant_id',$tenant)->where('fy_start',$start)->where('fy_end',$end)->exists();if(!$exists)DB::table('financial_year_locks')->insert(['id'=>(string)Str::uuid(),'tenant_id'=>$tenant,'fy_start'=>$start,'fy_end'=>$end,'created_at'=>now(),'updated_at'=>now()]);}
    private function assertYearOpen(string $tenant,string $date): void{if(!Schema::hasTable('financial_year_locks'))return;$this->ensureYear($tenant,$date);$locked=DB::table('financial_year_locks')->where('tenant_id',$tenant)->whereNotNull('locked_at')->whereDate('fy_start','<=',$date)->whereDate('fy_end','>=',$date)->exists();if($locked)throw ValidationException::withMessages(['date'=>['This financial year is locked.']]);}
    private function fyDates(?string $value): array{$date=$value?\Carbon\Carbon::parse($value):now();$year=$date->month>=4?$date->year:$date->year-1;return [sprintf('%04d-04-01',$year),sprintf('%04d-03-31',$year+1)];}
}
