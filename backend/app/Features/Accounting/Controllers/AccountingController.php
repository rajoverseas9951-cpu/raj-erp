<?php

namespace App\Features\Accounting\Controllers;

use App\Features\Accounting\Models\Ledger;
use App\Features\Accounting\Models\Voucher;
use App\Features\Accounting\Models\VoucherEntry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AccountingController
{
    private function tenant(Request $request): string
    {
        return (string) ($request->user()?->tenant_id ?? $request->header('X-Tenant-Id'));
    }

    public function vouchers(Request $request)
    {
        $query = Voucher::query()->where('tenant_id', $this->tenant($request))->with('entries.ledger');
        if ($request->filled('type')) $query->where('voucher_type', $request->string('type'));
        if ($request->filled('from')) $query->whereDate('voucher_date', '>=', $request->date('from'));
        if ($request->filled('to')) $query->whereDate('voucher_date', '<=', $request->date('to'));
        return response()->json(['success' => true, 'data' => $query->latest('voucher_date')->latest()->get()]);
    }

    public function storeVoucher(Request $request)
    {
        $data = $request->validate([
            'voucher_type' => ['required','in:receipt,payment,contra,journal,sales,purchase'],
            'voucher_date' => ['required','date'],
            'reference_number' => ['nullable','string','max:100'],
            'narration' => ['nullable','string','max:2000'],
            'entries' => ['required','array','min:2'],
            'entries.*.ledger_id' => ['required','uuid'],
            'entries.*.entry_type' => ['required','in:debit,credit'],
            'entries.*.amount' => ['required','numeric','gt:0'],
            'entries.*.description' => ['nullable','string','max:500'],
        ]);

        $tenantId = $this->tenant($request);
        $debit = collect($data['entries'])->where('entry_type', 'debit')->sum('amount');
        $credit = collect($data['entries'])->where('entry_type', 'credit')->sum('amount');
        if (round($debit, 2) !== round($credit, 2)) {
            throw ValidationException::withMessages(['entries' => ['Total Debit aur Total Credit equal hona chahiye.']]);
        }

        $ledgerIds = collect($data['entries'])->pluck('ledger_id')->unique();
        $validCount = Ledger::query()->where('tenant_id', $tenantId)->whereIn('id', $ledgerIds)->count();
        if ($validCount !== $ledgerIds->count()) {
            throw ValidationException::withMessages(['entries' => ['Ek ya zyada ledger invalid hain.']]);
        }

        $voucher = DB::transaction(function () use ($data, $tenantId, $request, $debit, $credit) {
            $prefix = strtoupper(substr($data['voucher_type'], 0, 3));
            $number = $prefix.'-'.now()->format('YmdHis').'-'.random_int(100, 999);
            $voucher = Voucher::create([
                'tenant_id' => $tenantId,
                'voucher_number' => $number,
                'voucher_type' => $data['voucher_type'],
                'voucher_date' => $data['voucher_date'],
                'reference_number' => $data['reference_number'] ?? null,
                'narration' => $data['narration'] ?? null,
                'total_debit' => $debit,
                'total_credit' => $credit,
                'status' => 'posted',
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);

            foreach ($data['entries'] as $entry) {
                VoucherEntry::create([
                    'id' => (string) Str::uuid(),
                    'tenant_id' => $tenantId,
                    'voucher_id' => $voucher->id,
                    'ledger_id' => $entry['ledger_id'],
                    'entry_type' => $entry['entry_type'],
                    'amount' => $entry['amount'],
                    'description' => $entry['description'] ?? null,
                ]);
            }

            return $voucher->load('entries.ledger');
        });

        return response()->json(['success' => true, 'data' => $voucher], 201);
    }

    public function dayBook(Request $request)
    {
        return $this->vouchers($request);
    }

    public function ledgerStatement(Request $request, string $ledgerId)
    {
        $tenantId = $this->tenant($request);
        $ledger = Ledger::where('tenant_id', $tenantId)->findOrFail($ledgerId);
        $entries = VoucherEntry::query()
            ->where('tenant_id', $tenantId)->where('ledger_id', $ledgerId)
            ->with('voucher')->orderBy('created_at')->get();

        $opening = (float) $ledger->opening_balance * ($ledger->balance_type === 'debit' ? 1 : -1);
        $running = $opening;
        $rows = $entries->map(function ($entry) use (&$running) {
            $debit = $entry->entry_type === 'debit' ? (float) $entry->amount : 0;
            $credit = $entry->entry_type === 'credit' ? (float) $entry->amount : 0;
            $running += $debit - $credit;
            return [
                'date' => optional($entry->voucher)->voucher_date?->format('Y-m-d'),
                'voucher_number' => optional($entry->voucher)->voucher_number,
                'voucher_type' => optional($entry->voucher)->voucher_type,
                'narration' => optional($entry->voucher)->narration,
                'debit' => $debit,
                'credit' => $credit,
                'balance' => abs($running),
                'balance_type' => $running >= 0 ? 'debit' : 'credit',
            ];
        });

        return response()->json(['success' => true, 'data' => ['ledger' => $ledger, 'opening_balance' => abs($opening), 'opening_type' => $opening >= 0 ? 'debit' : 'credit', 'entries' => $rows, 'closing_balance' => abs($running), 'closing_type' => $running >= 0 ? 'debit' : 'credit']]);
    }

    public function trialBalance(Request $request)
    {
        $tenantId = $this->tenant($request);
        $ledgers = Ledger::where('tenant_id', $tenantId)->orderBy('ledger_name')->get();
        $movements = VoucherEntry::query()->where('accounting_voucher_entries.tenant_id', $tenantId)
            ->join('accounting_vouchers', 'accounting_vouchers.id', '=', 'accounting_voucher_entries.voucher_id')
            ->where('accounting_vouchers.status', 'posted')
            ->select('ledger_id', DB::raw("SUM(CASE WHEN entry_type='debit' THEN amount ELSE 0 END) as debit"), DB::raw("SUM(CASE WHEN entry_type='credit' THEN amount ELSE 0 END) as credit"))
            ->groupBy('ledger_id')->get()->keyBy('ledger_id');

        $rows = $ledgers->map(function ($ledger) use ($movements) {
            $m = $movements->get($ledger->id);
            $balance = ($ledger->balance_type === 'debit' ? (float) $ledger->opening_balance : -(float) $ledger->opening_balance)
                + (float) ($m->debit ?? 0) - (float) ($m->credit ?? 0);
            return ['ledger_id' => $ledger->id, 'ledger_name' => $ledger->ledger_name, 'ledger_group' => $ledger->ledger_group, 'debit' => $balance > 0 ? $balance : 0, 'credit' => $balance < 0 ? abs($balance) : 0];
        });

        return response()->json(['success' => true, 'data' => ['rows' => $rows, 'total_debit' => $rows->sum('debit'), 'total_credit' => $rows->sum('credit')]]);
    }

    public function profitLoss(Request $request)
    {
        $tenant = $this->tenant($request);
        $policies = DB::table('vehicle_insurances')->where('tenant_id', $tenant)->whereNull('deleted_at')
            ->where(fn ($query) => $query->whereNull('status')->orWhere('status', '!=', 'cancelled'));
        $grossCommission = round((float) (clone $policies)->sum('gross_commission'), 2);
        $agentCommission = round((float) (clone $policies)->sum('agent_commission'), 2);
        $tds = round((float) DB::table('insurance_commissions')->where('tenant_id', $tenant)
            ->whereNull('deleted_at')->sum('tds_amount'), 2);
        $recordedExpenses = round((float) DB::table('accounting_vouchers')->where('tenant_id', $tenant)
            ->where('status', 'posted')->where('voucher_type', 'payment')->sum('total_debit'), 2);
        $expense = round($tds + $agentCommission + $recordedExpenses, 2);
        return response()->json(['success' => true, 'data' => [
            'income' => $grossCommission, 'expense' => $expense,
            'gross_commission' => $grossCommission, 'tds' => $tds,
            'agent_commission' => $agentCommission, 'recorded_expenses' => $recordedExpenses,
            'net_profit' => round($grossCommission - $expense, 2),
        ]])->header('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    }

    public function balanceSheet(Request $request)
    {
        $trial = collect($this->trialData($request));
        $assetGroups = ['Bank Accounts','Cash-in-Hand','Fixed Assets','Current Assets','Sundry Debtors'];
        $liabilityGroups = ['Loans & Liabilities','Capital Account','Sundry Creditors'];
        $assets = $trial->whereIn('ledger_group', $assetGroups)->sum(fn ($r) => $r['debit'] - $r['credit']);
        $liabilities = $trial->whereIn('ledger_group', $liabilityGroups)->sum(fn ($r) => $r['credit'] - $r['debit']);
        return response()->json(['success' => true, 'data' => ['assets' => $assets, 'liabilities' => $liabilities, 'difference' => $assets - $liabilities]]);
    }

    private function trialData(Request $request): array
    {
        $tenantId = $this->tenant($request);
        $ledgers = Ledger::where('tenant_id', $tenantId)->get();
        $movements = VoucherEntry::query()->where('accounting_voucher_entries.tenant_id', $tenantId)
            ->join('accounting_vouchers', 'accounting_vouchers.id', '=', 'accounting_voucher_entries.voucher_id')
            ->where('accounting_vouchers.status', 'posted')
            ->select('ledger_id', DB::raw("SUM(CASE WHEN entry_type='debit' THEN amount ELSE 0 END) as debit"), DB::raw("SUM(CASE WHEN entry_type='credit' THEN amount ELSE 0 END) as credit"))
            ->groupBy('ledger_id')->get()->keyBy('ledger_id');
        return $ledgers->map(function ($ledger) use ($movements) {
            $m = $movements->get($ledger->id);
            $balance = ($ledger->balance_type === 'debit' ? (float) $ledger->opening_balance : -(float) $ledger->opening_balance)
                + (float) ($m->debit ?? 0) - (float) ($m->credit ?? 0);
            return ['ledger_group' => $ledger->ledger_group, 'debit' => $balance > 0 ? $balance : 0, 'credit' => $balance < 0 ? abs($balance) : 0];
        })->all();
    }
}
