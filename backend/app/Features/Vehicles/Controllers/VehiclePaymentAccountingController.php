<?php

namespace App\Features\Vehicles\Controllers;

use App\Features\Vehicles\Models\Vehicle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class VehiclePaymentAccountingController
{
    public function store(Request $request, string $vehicle)
    {
        abort_unless($request->user()?->is_admin || $request->user()?->can('vehicle.financial.edit'), 403);

        $model = Vehicle::where('tenant_id', (string) $request->user()?->tenant_id)
            ->with('customer')
            ->findOrFail($vehicle);

        $tenant = (string) $model->tenant_id;
        $data = $request->validate([
            'payment_type' => ['required', Rule::in(['Receive', 'Debit'])],
            'ledger_id' => ['nullable', 'uuid'],
            'account' => ['nullable', 'string', 'max:160'],
            'reference_number' => ['nullable', 'string', 'max:120'],
            'issue_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'paid_amount' => ['nullable', 'numeric', 'min:0.01'],
            'billed_amount' => ['nullable', 'numeric', 'min:0.01'],
        ]);

        $isReceipt = $data['payment_type'] === 'Receive';
        $amount = round((float) ($isReceipt ? ($data['paid_amount'] ?? 0) : ($data['billed_amount'] ?? 0)), 2);
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => ['Amount must be greater than zero.']]);
        }

        $cashBank = null;
        if ($isReceipt) {
            $cashBank = DB::table('ledgers')
                ->where('tenant_id', $tenant)
                ->where('id', $data['ledger_id'] ?? null)
                ->whereNull('deleted_at')
                ->where('status', 'active')
                ->first();

            if (! $cashBank || ! in_array($cashBank->ledger_group, ['Bank Accounts', 'Cash-in-Hand'], true)) {
                throw ValidationException::withMessages(['ledger_id' => ['Select an active Cash or Bank ledger.']]);
            }
        }

        $id = (string) Str::uuid();
        $actor = $request->user()?->id;
        $voucherId = null;

        DB::transaction(function () use ($data, $id, $actor, $model, $tenant, $isReceipt, $amount, $cashBank, &$voucherId) {
            $customerLedger = $this->ensureCustomerLedger($model, $actor);

            if ($isReceipt) {
                $voucherId = $this->voucher(
                    $tenant,
                    'receipt',
                    $data['issue_date'],
                    $data['reference_number'] ?? null,
                    'Customer receipt for '.$model->vehicle_number,
                    [
                        [(string) $cashBank->id, 'debit', $amount],
                        [$customerLedger, 'credit', $amount],
                    ],
                    $actor
                );
            } else {
                $chargeLedger = $this->ensureLedger($tenant, 'CUSTOMER CHARGE ADJUSTMENT', 'Direct Incomes', 'credit', $actor);
                $voucherId = $this->voucher(
                    $tenant,
                    'journal',
                    $data['issue_date'],
                    $data['reference_number'] ?? null,
                    'Customer debit/charge for '.$model->vehicle_number,
                    [
                        [$customerLedger, 'debit', $amount],
                        [$chargeLedger, 'credit', $amount],
                    ],
                    $actor
                );
            }

            DB::table('vehicle_payments')->insert([
                'id' => $id,
                'tenant_id' => $tenant,
                'vehicle_id' => $model->id,
                'voucher_id' => $voucherId,
                'ledger_id' => $isReceipt ? (string) $cashBank->id : null,
                'payment_type' => $data['payment_type'],
                'account' => $isReceipt ? (string) $cashBank->ledger_name : 'CUSTOMER CHARGE ADJUSTMENT',
                'reference_number' => $data['reference_number'] ?? null,
                'issue_date' => $data['issue_date'],
                'notes' => $data['notes'] ?? null,
                'billed_amount' => $isReceipt ? 0 : $amount,
                'paid_amount' => $isReceipt ? $amount : 0,
                'amount' => 0,
                'party_amount' => 0,
                'created_by' => $actor,
                'updated_by' => $actor,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->syncVehicleOutstanding($tenant, (string) $model->id, $actor);

            DB::table('vehicle_timeline_events')->insert([
                'id' => (string) Str::uuid(),
                'tenant_id' => $tenant,
                'vehicle_id' => $model->id,
                'actor_id' => $actor,
                'event_type' => $isReceipt ? 'vehicle.payment.received' : 'vehicle.payment.debit',
                'title' => $isReceipt ? 'Customer payment received' : 'Customer debit added',
                'description' => $data['reference_number'] ?? null,
                'metadata' => json_encode(['record_id' => $id, 'voucher_id' => $voucherId, 'amount' => $amount]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'data' => DB::table('vehicle_payments')->where('id', $id)->first(),
        ], 201);
    }

    public function destroy(Request $request, string $vehicle, string $record)
    {
        abort_unless($request->user()?->is_admin || $request->user()?->can('vehicle.financial.edit'), 403);

        $model = Vehicle::where('tenant_id', (string) $request->user()?->tenant_id)->findOrFail($vehicle);
        $tenant = (string) $model->tenant_id;
        $actor = $request->user()?->id;

        DB::transaction(function () use ($tenant, $model, $record, $actor) {
            $row = DB::table('vehicle_payments')
                ->where('tenant_id', $tenant)
                ->where('vehicle_id', $model->id)
                ->where('id', $record)
                ->whereNull('deleted_at')
                ->lockForUpdate()
                ->first();
            abort_unless($row, 404);

            DB::table('vehicle_payments')->where('id', $record)->update([
                'deleted_at' => now(),
                'updated_by' => $actor,
                'updated_at' => now(),
            ]);

            if (! empty($row->voucher_id)) {
                DB::table('accounting_vouchers')
                    ->where('tenant_id', $tenant)
                    ->where('id', $row->voucher_id)
                    ->whereNull('deleted_at')
                    ->update(['status' => 'cancelled', 'updated_by' => $actor, 'updated_at' => now()]);
            }

            $this->syncVehicleOutstanding($tenant, (string) $model->id, $actor);
        });

        return response()->json(['success' => true, 'data' => null]);
    }

    private function syncVehicleOutstanding(string $tenant, string $vehicleId, ?string $actor): void
    {
        $payments = DB::table('vehicle_payments')
            ->where('tenant_id', $tenant)
            ->where('vehicle_id', $vehicleId)
            ->whereNull('deleted_at');

        $billed = round((float) (clone $payments)->sum('billed_amount'), 2);
        $received = round((float) (clone $payments)->sum('paid_amount'), 2);
        $outstanding = max(0, round($billed - $received, 2));

        DB::table('vehicles')->where('tenant_id', $tenant)->where('id', $vehicleId)->update([
            'payment_due' => $outstanding,
            'updated_by' => $actor,
            'updated_at' => now(),
        ]);
    }

    private function ensureCustomerLedger(Vehicle $vehicle, ?string $actor): string
    {
        if (! $vehicle->customer) {
            throw ValidationException::withMessages(['customer' => ['Vehicle customer is required before receiving payment.']]);
        }

        $customer = $vehicle->customer;
        $name = trim(implode(' ', array_filter([$customer->first_name, $customer->middle_name, $customer->last_name])));
        $existing = DB::table('ledgers')
            ->where('tenant_id', $vehicle->tenant_id)
            ->where('customer_id', $customer->id)
            ->whereNull('deleted_at')
            ->first();

        if ($existing) return (string) $existing->id;

        return $this->ensureLedger(
            (string) $vehicle->tenant_id,
            $name ?: ('CUSTOMER '.$customer->id),
            'Sundry Debtors',
            'debit',
            $actor,
            (string) $customer->id
        );
    }

    private function ensureLedger(string $tenant, string $name, string $group, string $balanceType, ?string $actor, ?string $customerId = null): string
    {
        $query = DB::table('ledgers')->where('tenant_id', $tenant)->whereNull('deleted_at');
        if ($customerId) $query->where('customer_id', $customerId);
        else $query->whereRaw('LOWER(ledger_name) = ?', [strtolower(trim($name))]);

        $existing = $query->first();
        if ($existing) return (string) $existing->id;

        $id = (string) Str::uuid();
        DB::table('ledgers')->insert([
            'id' => $id,
            'tenant_id' => $tenant,
            'customer_id' => $customerId,
            'ledger_name' => strtoupper(trim($name)),
            'ledger_group' => $group,
            'opening_balance' => 0,
            'balance_type' => $balanceType,
            'credit_limit' => 0,
            'credit_days' => 0,
            'gst_applicable' => false,
            'status' => 'active',
            'created_by' => $actor,
            'updated_by' => $actor,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return $id;
    }

    private function voucher(string $tenant, string $type, string $date, ?string $reference, string $narration, array $entries, ?string $actor): string
    {
        $id = (string) Str::uuid();
        $total = round((float) collect($entries)->where(1, 'debit')->sum(2), 2);

        DB::table('accounting_vouchers')->insert([
            'id' => $id,
            'tenant_id' => $tenant,
            'voucher_number' => strtoupper(substr($type, 0, 3)).'-VEH-'.now()->format('YmdHis').'-'.random_int(100, 999),
            'voucher_type' => $type,
            'voucher_date' => $date,
            'reference_number' => $reference,
            'narration' => $narration,
            'total_debit' => $total,
            'total_credit' => $total,
            'status' => 'posted',
            'created_by' => $actor,
            'updated_by' => $actor,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($entries as [$ledgerId, $entryType, $amount]) {
            DB::table('accounting_voucher_entries')->insert([
                'id' => (string) Str::uuid(),
                'tenant_id' => $tenant,
                'voucher_id' => $id,
                'ledger_id' => $ledgerId,
                'entry_type' => $entryType,
                'amount' => round((float) $amount, 2),
                'description' => $narration,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $id;
    }
}
