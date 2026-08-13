<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        DB::transaction(function () {
            $rows = DB::table('vehicle_payments')
                ->whereNull('deleted_at')
                ->whereNull('voucher_id')
                ->where('paid_amount', '>', 0)
                ->whereNotNull('ledger_id')
                ->orderBy('created_at')
                ->get();

            foreach ($rows as $row) {
                $vehicle = DB::table('vehicles')
                    ->where('tenant_id', $row->tenant_id)
                    ->where('id', $row->vehicle_id)
                    ->whereNull('deleted_at')
                    ->first();
                if (! $vehicle || empty($vehicle->customer_id)) continue;

                $cashBank = DB::table('ledgers')
                    ->where('tenant_id', $row->tenant_id)
                    ->where('id', $row->ledger_id)
                    ->whereNull('deleted_at')
                    ->first();
                if (! $cashBank || ! in_array($cashBank->ledger_group, ['Bank Accounts', 'Cash-in-Hand'], true)) continue;

                $customerLedger = DB::table('ledgers')
                    ->where('tenant_id', $row->tenant_id)
                    ->where('customer_id', $vehicle->customer_id)
                    ->whereNull('deleted_at')
                    ->first();

                if (! $customerLedger) {
                    $customer = DB::table('customers')->where('tenant_id', $row->tenant_id)->where('id', $vehicle->customer_id)->first();
                    if (! $customer) continue;
                    $name = trim(implode(' ', array_filter([$customer->first_name ?? null, $customer->middle_name ?? null, $customer->last_name ?? null])));
                    $customerLedgerId = (string) Str::uuid();
                    DB::table('ledgers')->insert([
                        'id' => $customerLedgerId,
                        'tenant_id' => $row->tenant_id,
                        'customer_id' => $vehicle->customer_id,
                        'ledger_name' => strtoupper($name ?: ('CUSTOMER '.$vehicle->customer_id)),
                        'ledger_group' => 'Sundry Debtors',
                        'opening_balance' => 0,
                        'balance_type' => 'debit',
                        'credit_limit' => 0,
                        'credit_days' => 0,
                        'gst_applicable' => false,
                        'status' => 'active',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                } else {
                    $customerLedgerId = (string) $customerLedger->id;
                }

                $amount = round((float) $row->paid_amount, 2);
                $voucherId = (string) Str::uuid();
                $date = $row->issue_date ?: optional($row->created_at ? \Carbon\Carbon::parse($row->created_at) : now())->toDateString();
                $narration = 'Customer receipt for '.$vehicle->vehicle_number.' (backfilled)';

                DB::table('accounting_vouchers')->insert([
                    'id' => $voucherId,
                    'tenant_id' => $row->tenant_id,
                    'voucher_number' => 'REC-VEH-BF-'.now()->format('YmdHis').'-'.random_int(1000, 9999),
                    'voucher_type' => 'receipt',
                    'voucher_date' => $date,
                    'reference_number' => $row->reference_number,
                    'narration' => $narration,
                    'total_debit' => $amount,
                    'total_credit' => $amount,
                    'status' => 'posted',
                    'created_by' => $row->created_by,
                    'updated_by' => $row->updated_by,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                foreach ([
                    [(string) $cashBank->id, 'debit'],
                    [$customerLedgerId, 'credit'],
                ] as [$ledgerId, $type]) {
                    DB::table('accounting_voucher_entries')->insert([
                        'id' => (string) Str::uuid(),
                        'tenant_id' => $row->tenant_id,
                        'voucher_id' => $voucherId,
                        'ledger_id' => $ledgerId,
                        'entry_type' => $type,
                        'amount' => $amount,
                        'description' => $narration,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                DB::table('vehicle_payments')->where('id', $row->id)->update([
                    'voucher_id' => $voucherId,
                    'updated_at' => now(),
                ]);
            }

            $vehicles = DB::table('vehicles')->whereNull('deleted_at')->select('id', 'tenant_id')->get();
            foreach ($vehicles as $vehicle) {
                $payments = DB::table('vehicle_payments')
                    ->where('tenant_id', $vehicle->tenant_id)
                    ->where('vehicle_id', $vehicle->id)
                    ->whereNull('deleted_at');
                $billed = round((float) (clone $payments)->sum('billed_amount'), 2);
                $received = round((float) (clone $payments)->sum('paid_amount'), 2);
                DB::table('vehicles')->where('id', $vehicle->id)->update([
                    'payment_due' => max(0, round($billed - $received, 2)),
                    'updated_at' => now(),
                ]);
            }
        });
    }

    public function down(): void
    {
        // Financial backfills are intentionally not reversed automatically.
    }
};
