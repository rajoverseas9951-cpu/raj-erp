<?php

namespace App\Features\Vehicles\Controllers;

use App\Features\Vehicles\Models\Vehicle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RtoWorkAccountingController
{
    public function store(Request $request, string $vehicle)
    {
        abort_unless($request->user()?->can('vehicle.update'), 403);
        $model = Vehicle::where('tenant_id', (string) $request->user()?->tenant_id)->with('customer')->findOrFail($vehicle);
        $tenant = (string) $model->tenant_id;

        $data = $request->validate([
            'work_type' => ['required', 'string', 'max:160'],
            'receipt_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'min:0'],
            'reference_number' => ['required', 'string', 'max:120'],
            'rto_office' => ['required', 'string', 'max:160'],
            'external_agent' => ['nullable', 'string', 'max:160'],
            'agent_amount' => ['nullable', 'numeric', 'min:0'],
            'broker' => ['nullable', 'string', 'max:160'],
            'assigned_agent' => ['nullable', 'string', 'max:160'],
            'faceless_appointment' => ['nullable', 'boolean'],
            'process_date' => ['nullable', 'date'],
            'approval_date' => ['nullable', 'date'],
            'rc_received_date' => ['nullable', 'date'],
            'rc_delivered_date' => ['nullable', 'date'],
            'period' => ['nullable', 'string', 'max:80'],
            'status' => ['nullable', 'string', 'max:40'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'government_fee' => ['nullable', 'numeric', 'min:0'],
            'government_fee_paid_by' => ['required', Rule::in(['owner', 'us', 'agent'])],
            'government_fee_bank_ledger_id' => ['nullable', 'uuid'],
        ]);

        // IMPORTANT ACCOUNTING SEMANTICS:
        // amount = total package/customer quote INCLUDING government fee.
        // government_fee = statutory/pass-through component only.
        // service/other charge = amount - government_fee and is the only RTO income.
        $totalAmount = round((float) $data['amount'], 2);
        $governmentFee = round((float) ($data['government_fee'] ?? 0), 2);
        $paidBy = $data['government_fee_paid_by'];

        if ($governmentFee > $totalAmount) {
            throw ValidationException::withMessages(['government_fee' => ['Government fee cannot be more than the total amount charged.']]);
        }

        $serviceCharge = round($totalAmount - $governmentFee, 2);

        if ($governmentFee > 0 && $paidBy === 'us') {
            $bank = DB::table('accounting_ledgers')->where('tenant_id', $tenant)->where('id', $data['government_fee_bank_ledger_id'] ?? null)->first();
            if (! $bank || ! in_array($bank->ledger_group, ['Bank Accounts', 'Cash-in-Hand'], true)) {
                throw ValidationException::withMessages(['government_fee_bank_ledger_id' => ['Select the bank/cash account used to pay the government fee.']]);
            }
        }
        if ($governmentFee > 0 && $paidBy === 'agent' && empty($data['external_agent'])) {
            throw ValidationException::withMessages(['external_agent' => ['Select/enter the RTO agent who paid the government fee.']]);
        }

        // If owner paid statutory fee directly, we never collected/paid that component.
        $customerBill = round($paidBy === 'owner' ? $serviceCharge : $totalAmount, 2);
        $id = (string) Str::uuid();
        $actor = $request->user()?->id;

        DB::transaction(function () use ($data, $id, $model, $tenant, $actor, $totalAmount, $serviceCharge, $governmentFee, $paidBy, $customerBill) {
            $invoiceVoucher = $this->postCustomerInvoice(
                $model,
                $data['receipt_date'],
                $data['reference_number'],
                $serviceCharge,
                $paidBy === 'owner' ? 0 : $governmentFee,
                $actor
            );

            $governmentVoucher = null;
            if ($governmentFee > 0 && $paidBy === 'us') {
                $governmentVoucher = $this->postGovernmentPaymentToBank($tenant, $data['receipt_date'], $data['reference_number'], $governmentFee, (string) $data['government_fee_bank_ledger_id'], $actor);
            } elseif ($governmentFee > 0 && $paidBy === 'agent') {
                $governmentVoucher = $this->postGovernmentPaymentByAgent($tenant, $data['receipt_date'], $data['reference_number'], $governmentFee, (string) $data['external_agent'], $actor);
            }

            DB::table('vehicle_rto_processes')->insert([
                'id' => $id,
                'tenant_id' => $tenant,
                'vehicle_id' => $model->id,
                'work_type' => $data['work_type'],
                'receipt_date' => $data['receipt_date'],
                'amount' => $totalAmount,
                'reference_number' => $data['reference_number'],
                'rto_office' => $data['rto_office'],
                'external_agent' => $data['external_agent'] ?? null,
                'agent_amount' => $data['agent_amount'] ?? null,
                'broker' => $data['broker'] ?? null,
                'assigned_agent' => $data['assigned_agent'] ?? null,
                'faceless_appointment' => (bool) ($data['faceless_appointment'] ?? false),
                'process_date' => $data['process_date'] ?? null,
                'approval_date' => $data['approval_date'] ?? null,
                'rc_received_date' => $data['rc_received_date'] ?? null,
                'rc_delivered_date' => $data['rc_delivered_date'] ?? null,
                'period' => $data['period'] ?? null,
                'status' => $data['status'] ?? 'ACTIVE',
                'notes' => $data['notes'] ?? null,
                'government_fee' => $governmentFee,
                'government_fee_paid_by' => $paidBy,
                'government_fee_bank_ledger_id' => $data['government_fee_bank_ledger_id'] ?? null,
                'customer_bill_amount' => $customerBill,
                'invoice_voucher_id' => $invoiceVoucher,
                'government_fee_voucher_id' => $governmentVoucher,
                'created_by' => $actor,
                'updated_by' => $actor,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('vehicle_timeline_events')->insert([
                'id' => (string) Str::uuid(), 'tenant_id' => $tenant, 'vehicle_id' => $model->id, 'actor_id' => $actor,
                'event_type' => 'vehicle.rto_process.created', 'title' => 'RTO Process added', 'description' => $data['reference_number'],
                'metadata' => json_encode([
                    'record_id' => $id,
                    'total_amount' => $totalAmount,
                    'service_other_charge' => $serviceCharge,
                    'government_fee' => $governmentFee,
                    'government_fee_paid_by' => $paidBy,
                    'customer_bill_amount' => $customerBill,
                ]),
                'created_at' => now(), 'updated_at' => now(),
            ]);
        });

        return response()->json(['success' => true, 'data' => DB::table('vehicle_rto_processes')->where('id', $id)->first()], 201);
    }

    private function postCustomerInvoice(Vehicle $vehicle, string $date, string $reference, float $serviceCharge, float $recoverableGovernmentFee, ?string $actor): ?string
    {
        $total = round($serviceCharge + $recoverableGovernmentFee, 2);
        if ($total <= 0) return null;

        $customer = $vehicle->customer;
        if (! $customer) throw ValidationException::withMessages(['customer' => ['Vehicle customer is required before RTO billing.']]);
        $customerName = trim(implode(' ', array_filter([$customer->first_name, $customer->middle_name, $customer->last_name])));
        $customerLedger = $this->ensureLedger((string) $vehicle->tenant_id, $customerName ?: ('CUSTOMER '.$customer->id), 'Sundry Debtors', 'debit', $actor, $customer->id);
        $incomeLedger = $this->ensureLedger((string) $vehicle->tenant_id, 'RTO SERVICE INCOME', 'Direct Incomes', 'credit', $actor);
        $govLedger = $recoverableGovernmentFee > 0 ? $this->ensureLedger((string) $vehicle->tenant_id, 'GOVERNMENT FEES RECOVERABLE', 'Current Assets', 'debit', $actor) : null;

        $entries = [[$customerLedger, 'debit', $total], [$incomeLedger, 'credit', $serviceCharge]];
        if ($recoverableGovernmentFee > 0 && $govLedger) $entries[] = [$govLedger, 'credit', $recoverableGovernmentFee];
        return $this->voucher((string) $vehicle->tenant_id, 'journal', $date, $reference, 'RTO customer bill: '.$vehicle->vehicle_number, $entries, $actor);
    }

    private function postGovernmentPaymentToBank(string $tenant, string $date, string $reference, float $amount, string $bankLedgerId, ?string $actor): string
    {
        $govLedger = $this->ensureLedger($tenant, 'GOVERNMENT FEES RECOVERABLE', 'Current Assets', 'debit', $actor);
        return $this->voucher($tenant, 'payment', $date, $reference, 'Government fee paid by office', [[$govLedger, 'debit', $amount], [$bankLedgerId, 'credit', $amount]], $actor);
    }

    private function postGovernmentPaymentByAgent(string $tenant, string $date, string $reference, float $amount, string $agentName, ?string $actor): string
    {
        $govLedger = $this->ensureLedger($tenant, 'GOVERNMENT FEES RECOVERABLE', 'Current Assets', 'debit', $actor);
        $agentLedger = $this->ensureLedger($tenant, $agentName, 'Sundry Creditors', 'credit', $actor);
        return $this->voucher($tenant, 'journal', $date, $reference, 'Government fee paid by RTO agent', [[$govLedger, 'debit', $amount], [$agentLedger, 'credit', $amount]], $actor);
    }

    private function ensureLedger(string $tenant, string $name, string $group, string $balanceType, ?string $actor, ?string $customerId = null): string
    {
        $query = DB::table('accounting_ledgers')->where('tenant_id', $tenant);
        if ($customerId) $query->where('customer_id', $customerId); else $query->whereRaw('LOWER(ledger_name) = ?', [strtolower(trim($name))]);
        $existing = $query->first();
        if ($existing) return (string) $existing->id;

        $id = (string) Str::uuid();
        DB::table('accounting_ledgers')->insert([
            'id' => $id, 'tenant_id' => $tenant, 'customer_id' => $customerId, 'ledger_name' => strtoupper(trim($name)), 'ledger_group' => $group,
            'opening_balance' => 0, 'balance_type' => $balanceType, 'credit_limit' => 0, 'credit_days' => 0, 'gst_applicable' => false,
            'status' => 'active', 'created_by' => $actor, 'updated_by' => $actor, 'created_at' => now(), 'updated_at' => now(),
        ]);
        return $id;
    }

    private function voucher(string $tenant, string $type, string $date, string $reference, string $narration, array $entries, ?string $actor): string
    {
        $id = (string) Str::uuid();
        $total = round((float) collect($entries)->where(1, 'debit')->sum(2), 2);
        DB::table('accounting_vouchers')->insert([
            'id' => $id, 'tenant_id' => $tenant, 'voucher_number' => strtoupper(substr($type, 0, 3)).'-RTO-'.now()->format('YmdHis').'-'.random_int(100, 999),
            'voucher_type' => $type, 'voucher_date' => $date, 'reference_number' => $reference, 'narration' => $narration,
            'total_debit' => $total, 'total_credit' => $total, 'status' => 'posted', 'created_by' => $actor, 'updated_by' => $actor,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        foreach ($entries as [$ledgerId, $entryType, $amount]) {
            if ((float) $amount <= 0) continue;
            DB::table('accounting_voucher_entries')->insert([
                'id' => (string) Str::uuid(), 'tenant_id' => $tenant, 'voucher_id' => $id, 'ledger_id' => $ledgerId,
                'entry_type' => $entryType, 'amount' => round((float) $amount, 2), 'description' => $narration, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        return $id;
    }
}
