<?php

namespace App\Features\Accounting\Controllers;

use App\Features\Accounting\Models\Ledger;
use App\Features\Accounting\Models\Voucher;
use App\Features\Accounting\Models\VoucherEntry;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AccountingController
{
    private function tenant(Request $request): string
    {
        return (string) ($request->user()?->tenant_id ?? $request->header('X-Tenant-Id'));
    }

    private function fy(Request $request): array
    {
        if ($request->filled('from') || $request->filled('to')) {
            $from = $request->filled('from') ? Carbon::parse($request->input('from'))->toDateString() : '1900-04-01';
            $to = $request->filled('to') ? Carbon::parse($request->input('to'))->toDateString() : now()->toDateString();
            return [$from, $to];
        }
        $d = now();
        $year = $d->month >= 4 ? $d->year : $d->year - 1;
        return [sprintf('%04d-04-01', $year), sprintf('%04d-03-31', $year + 1)];
    }

    private function assertYearOpen(string $tenant, string $date): void
    {
        if (!Schema::hasTable('financial_year_locks')) return;
        $locked = DB::table('financial_year_locks')->where('tenant_id', $tenant)->whereNotNull('locked_at')
            ->whereDate('fy_start', '<=', $date)->whereDate('fy_end', '>=', $date)->exists();
        if ($locked) throw ValidationException::withMessages(['voucher_date' => ['This financial year is locked.']]);
    }

    public function vouchers(Request $request)
    {
        [$from,$to] = $this->fy($request);
        $query = Voucher::query()->where('tenant_id', $this->tenant($request))->with('entries.ledger')
            ->whereBetween('voucher_date', [$from,$to]);
        if ($request->filled('type')) $query->where('voucher_type', $request->string('type'));
        return response()->json(['success'=>true,'data'=>$query->latest('voucher_date')->latest()->get(), 'financial_year'=>['from'=>$from,'to'=>$to]]);
    }

    public function storeVoucher(Request $request)
    {
        $data = $request->validate([
            'voucher_type'=>['required','in:receipt,payment,contra,journal,sales,purchase'],
            'voucher_date'=>['required','date'],'reference_number'=>['nullable','string','max:100'],'narration'=>['nullable','string','max:2000'],
            'entries'=>['required','array','min:2'],'entries.*.ledger_id'=>['required','uuid'],'entries.*.entry_type'=>['required','in:debit,credit'],
            'entries.*.amount'=>['required','numeric','gt:0'],'entries.*.description'=>['nullable','string','max:500'],
        ]);
        $tenant = $this->tenant($request); $this->assertYearOpen($tenant,$data['voucher_date']);
        $debit=collect($data['entries'])->where('entry_type','debit')->sum('amount'); $credit=collect($data['entries'])->where('entry_type','credit')->sum('amount');
        if (round($debit,2)!==round($credit,2)) throw ValidationException::withMessages(['entries'=>['Total Debit and Credit must be equal.']]);
        $ids=collect($data['entries'])->pluck('ledger_id')->unique();
        if (Ledger::where('tenant_id',$tenant)->whereIn('id',$ids)->count()!==$ids->count()) throw ValidationException::withMessages(['entries'=>['Invalid ledger selected.']]);
        $voucher=DB::transaction(function() use($data,$tenant,$request,$debit,$credit){
            $v=Voucher::create(['tenant_id'=>$tenant,'voucher_number'=>strtoupper(substr($data['voucher_type'],0,3)).'-'.now()->format('YmdHis').'-'.random_int(100,999),'voucher_type'=>$data['voucher_type'],'voucher_date'=>$data['voucher_date'],'reference_number'=>$data['reference_number']??null,'narration'=>$data['narration']??null,'total_debit'=>$debit,'total_credit'=>$credit,'status'=>'posted','created_by'=>$request->user()?->id,'updated_by'=>$request->user()?->id]);
            foreach($data['entries'] as $e) VoucherEntry::create(['id'=>(string)Str::uuid(),'tenant_id'=>$tenant,'voucher_id'=>$v->id,'ledger_id'=>$e['ledger_id'],'entry_type'=>$e['entry_type'],'amount'=>$e['amount'],'description'=>$e['description']??null]);
            return $v->load('entries.ledger');
        });
        return response()->json(['success'=>true,'data'=>$voucher],201);
    }

    public function dayBook(Request $request) { return $this->vouchers($request); }

    public function ledgerStatement(Request $request, string $ledgerId)
    {
        $tenant=$this->tenant($request); [$from,$to]=$this->fy($request); $ledger=Ledger::where('tenant_id',$tenant)->findOrFail($ledgerId);
        $base=(float)$ledger->opening_balance*($ledger->balance_type==='debit'?1:-1);
        $pre=VoucherEntry::query()->where('accounting_voucher_entries.tenant_id',$tenant)->where('ledger_id',$ledgerId)
            ->join('accounting_vouchers','accounting_vouchers.id','=','accounting_voucher_entries.voucher_id')->where('accounting_vouchers.status','posted')->whereDate('voucher_date','<',$from)
            ->selectRaw("COALESCE(SUM(CASE WHEN entry_type='debit' THEN amount ELSE -amount END),0) net")->value('net');
        $running=$base+(float)$pre;
        $entries=VoucherEntry::query()->where('accounting_voucher_entries.tenant_id',$tenant)->where('ledger_id',$ledgerId)
            ->join('accounting_vouchers','accounting_vouchers.id','=','accounting_voucher_entries.voucher_id')->where('accounting_vouchers.status','posted')->whereBetween('voucher_date',[$from,$to])
            ->select('accounting_voucher_entries.*','accounting_vouchers.voucher_date','accounting_vouchers.voucher_number','accounting_vouchers.voucher_type','accounting_vouchers.narration')->orderBy('voucher_date')->orderBy('accounting_voucher_entries.created_at')->get();
        $opening=$running; $rows=$entries->map(function($e) use (&$running){$d=$e->entry_type==='debit'?(float)$e->amount:0;$c=$e->entry_type==='credit'?(float)$e->amount:0;$running+=$d-$c;return ['date'=>$e->voucher_date,'voucher_number'=>$e->voucher_number,'voucher_type'=>$e->voucher_type,'narration'=>$e->narration,'debit'=>$d,'credit'=>$c,'balance'=>abs($running),'balance_type'=>$running>=0?'debit':'credit'];});
        return response()->json(['success'=>true,'data'=>['ledger'=>$ledger,'financial_year'=>['from'=>$from,'to'=>$to],'opening_balance'=>abs($opening),'opening_type'=>$opening>=0?'debit':'credit','entries'=>$rows,'closing_balance'=>abs($running),'closing_type'=>$running>=0?'debit':'credit']]);
    }

    public function trialBalance(Request $request)
    {
        [$from,$to]=$this->fy($request); $rows=collect($this->trialData($request));
        return response()->json(['success'=>true,'data'=>['rows'=>$rows,'total_debit'=>$rows->sum('debit'),'total_credit'=>$rows->sum('credit'),'financial_year'=>['from'=>$from,'to'=>$to]]]);
    }

    public function profitLoss(Request $request)
    {
        $tenant=$this->tenant($request); [$from,$to]=$this->fy($request);
        $policies=DB::table('vehicle_insurances')->where('tenant_id',$tenant)->whereNull('deleted_at')->whereBetween('issue_date',[$from,$to])->where(fn($q)=>$q->whereNull('status')->orWhere('status','!=','cancelled'));
        $gross=round((float)(clone $policies)->sum('gross_commission'),2); $agent=round((float)(clone $policies)->sum('agent_commission'),2);
        $comm=DB::table('insurance_commissions')->where('tenant_id',$tenant)->whereNull('deleted_at')->whereBetween('created_at',[$from.' 00:00:00',$to.' 23:59:59']);
        $tds=round((float)$comm->sum('tds_amount'),2); [$rtoIncome,$rtoCost]=$this->rtoOperationalTotals($tenant,$from,$to);
        $recorded=round((float)DB::table('accounting_vouchers')->where('tenant_id',$tenant)->where('status','posted')->where('voucher_type','payment')->whereBetween('voucher_date',[$from,$to])->sum('total_debit'),2);
        $income=round($gross+$rtoIncome,2); $expense=round($tds+$agent+$rtoCost+$recorded,2);
        return response()->json(['success'=>true,'data'=>['financial_year'=>['from'=>$from,'to'=>$to],'income'=>$income,'expense'=>$expense,'insurance_commission'=>$gross,'insurance_agent_commission'=>$agent,'tds'=>$tds,'rto_income'=>$rtoIncome,'rto_cost'=>$rtoCost,'rto_profit'=>round($rtoIncome-$rtoCost,2),'recorded_expenses'=>$recorded,'net_profit'=>round($income-$expense,2)]])->header('Cache-Control','private, no-store, no-cache, must-revalidate');
    }

    public function balanceSheet(Request $request)
    {
        [$from,$to]=$this->fy($request); $trial=collect($this->trialData($request));
        $assets=round((float)$trial->whereIn('ledger_group',['Bank Accounts','Cash-in-Hand','Fixed Assets','Current Assets','Sundry Debtors'])->sum(fn($r)=>$r['debit']-$r['credit']),2);
        $book=round((float)$trial->whereIn('ledger_group',['Loans & Liabilities','Capital Account','Sundry Creditors'])->sum(fn($r)=>$r['credit']-$r['debit']),2);
        $pl=$this->profitLoss($request)->getData(true)['data']; $profit=round((float)($pl['net_profit']??0),2); $liabilities=round($book+$profit,2);
        return response()->json(['success'=>true,'data'=>['financial_year'=>['from'=>$from,'to'=>$to],'assets'=>$assets,'book_liabilities'=>$book,'current_year_profit'=>$profit,'liabilities'=>$liabilities,'difference'=>round($assets-$liabilities,2)]]);
    }

    private function rtoOperationalTotals(string $tenant,string $from,string $to): array
    {
        $income=0.0;$cost=0.0; $tables=['vehicle_rto_processes','vehicle_pucs','vehicle_fitnesses','vehicle_permits','vehicle_taxes','vehicle_counter_taxes','vehicle_hsrp_records','vehicle_sld_records','vehicle_transfer_processes'];
        foreach($tables as $table){if(!Schema::hasTable($table))continue;$q=DB::table($table)->where('tenant_id',$tenant)->whereNull('deleted_at');if(Schema::hasColumn($table,'created_at'))$q->whereBetween('created_at',[$from.' 00:00:00',$to.' 23:59:59']);foreach($q->get() as $r){$amount=(float)($r->amount??0);$party=(float)($r->party_amount??0);if($table==='vehicle_rto_processes'){$income+=$amount;$cost+=(float)($r->agent_amount??0);continue;}$income+=$party>0?$party:$amount;$cost+=$party>0?$amount:0;}}
        if(Schema::hasTable('service_works')){$works=DB::table('service_works')->where('tenant_id',$tenant)->whereNull('deleted_at')->whereIn('service_type',['driving_licence','passport'])->whereBetween('work_date',[$from,$to])->get();$income+=(float)$works->sum('amount');$cost+=(float)$works->sum('cost');}
        return [round($income,2),round($cost,2)];
    }

    private function trialData(Request $request): array
    {
        $tenant=$this->tenant($request); [$from,$to]=$this->fy($request); $ledgers=Ledger::where('tenant_id',$tenant)->get();
        $all=VoucherEntry::query()->where('accounting_voucher_entries.tenant_id',$tenant)->join('accounting_vouchers','accounting_vouchers.id','=','accounting_voucher_entries.voucher_id')->where('accounting_vouchers.status','posted')->whereDate('voucher_date','<=',$to)
            ->select('ledger_id',DB::raw("SUM(CASE WHEN entry_type='debit' THEN amount ELSE -amount END) net"))->groupBy('ledger_id')->get()->keyBy('ledger_id');
        $current=VoucherEntry::query()->where('accounting_voucher_entries.tenant_id',$tenant)->join('accounting_vouchers','accounting_vouchers.id','=','accounting_voucher_entries.voucher_id')->where('accounting_vouchers.status','posted')->whereBetween('voucher_date',[$from,$to])
            ->select('ledger_id',DB::raw("SUM(CASE WHEN entry_type='debit' THEN amount ELSE -amount END) net"))->groupBy('ledger_id')->get()->keyBy('ledger_id');
        $nominal=['Direct Expenses','Indirect Expenses','Direct Incomes','Indirect Incomes'];
        return $ledgers->map(function($l) use($all,$current,$nominal){$base=(float)$l->opening_balance*($l->balance_type==='debit'?1:-1);$movement=in_array($l->ledger_group,$nominal,true)?(float)($current->get($l->id)->net??0):(float)($all->get($l->id)->net??0);$balance=(in_array($l->ledger_group,$nominal,true)?0:$base)+$movement;return ['ledger_id'=>$l->id,'ledger_name'=>$l->ledger_name,'ledger_group'=>$l->ledger_group,'debit'=>$balance>0?$balance:0,'credit'=>$balance<0?abs($balance):0];})->all();
    }
}
