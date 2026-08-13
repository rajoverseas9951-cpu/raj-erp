<?php

namespace App\Features\Accounting\Controllers;

use App\Features\Accounting\Models\Ledger;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LedgerController
{
    public function index(Request $request)
    {
        $tenantId = (string) ($request->user()?->tenant_id ?? $request->header('X-Tenant-Id'));

        $ledgers = Ledger::query()
            ->where('tenant_id', $tenantId)
            ->orderBy('ledger_name')
            ->get();

        return response()->json(['success' => true, 'data' => $ledgers]);
    }

    public function store(Request $request)
    {
        $tenantId = (string) ($request->user()?->tenant_id ?? $request->header('X-Tenant-Id'));

        $data = $request->validate([
            'ledger_name' => ['required', 'string', 'max:200'],
            'ledger_group' => ['required', 'in:Sundry Debtors,Sundry Creditors,Bank Accounts,Cash-in-Hand,Direct Expenses,Indirect Expenses,Direct Incomes,Indirect Incomes,Loans & Liabilities,Capital Account,Fixed Assets,Current Assets,Other'],
            'opening_balance' => ['nullable', 'numeric', 'min:0'],
            'balance_type' => ['required', 'in:debit,credit'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
            'credit_days' => ['nullable', 'integer', 'min:0'],
            'gst_applicable' => ['nullable', 'boolean'],
            'status' => ['required', 'in:active,inactive'],
        ]);

        $ledgerName = strtoupper(trim($data['ledger_name']));
        $duplicate = Ledger::query()
            ->where('tenant_id', $tenantId)
            ->whereRaw('LOWER(ledger_name) = ?', [strtolower($ledgerName)])
            ->first();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'ledger_name' => ['A ledger with this name already exists. Use the existing ledger instead of creating a duplicate.'],
            ]);
        }

        $actorId = $request->user()?->id;

        $ledger = Ledger::create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $tenantId,
            'customer_id' => null,
            'ledger_name' => $ledgerName,
            'ledger_group' => $data['ledger_group'],
            'opening_balance' => $data['opening_balance'] ?? 0,
            'balance_type' => $data['balance_type'],
            'credit_limit' => $data['credit_limit'] ?? 0,
            'credit_days' => $data['credit_days'] ?? 0,
            'gst_applicable' => $data['gst_applicable'] ?? false,
            'status' => $data['status'],
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return response()->json(['success' => true, 'data' => $ledger], 201);
    }
}
