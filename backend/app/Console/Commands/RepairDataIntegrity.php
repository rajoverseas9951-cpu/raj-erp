<?php

namespace App\Console\Commands;

use App\Support\DataIntegrityInspector;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class RepairDataIntegrity extends Command
{
    protected $signature = 'data:repair-integrity {--dry-run : Preview repairs (default)} {--apply : Apply non-destructive repairs}';
    protected $description = 'Preview or apply non-destructive integrity repairs; records are never deleted';

    public function handle(DataIntegrityInspector $inspector): int
    {
        $issues = $inspector->inspect();
        $apply = (bool) $this->option('apply');
        foreach ($issues as $name => $ids) foreach ($ids as $id) {
            $this->line(($apply ? 'APPLY' : 'PROPOSE').' '.str_replace('_', ' ', $name)." {$id}");
        }

        $policies = array_unique(array_merge(
            $issues['policies_with_missing_vehicles'],
            $issues['policies_linked_to_deleted_vehicles'],
        ));
        foreach ($policies as $policyId) $this->describePolicyRepair($policyId, $apply ? 'APPLY' : 'PROPOSE');

        if (! $apply) { $this->info('Dry run complete. Re-run with --apply to make the listed non-destructive status/archive repairs.'); return self::SUCCESS; }

        DB::transaction(function () use ($issues, $policies) {
            foreach ($policies as $policyId) $this->repairPolicy($policyId);
            if ($issues['orphan_commissions']) DB::table('insurance_commissions')->whereIn('id', $issues['orphan_commissions'])->update([
                'status' => 'cancelled', 'remarks' => 'Integrity repair: linked policy is missing.', 'updated_at' => now(),
            ]);
        });
        $this->info('Non-destructive repairs applied. No records were deleted.');
        return self::SUCCESS;
    }

    private function describePolicyRepair(string $policyId, string $action): void
    {
        $policy = DB::table('vehicle_insurances')->where('id', $policyId)->first();
        if (! $policy) return;
        $commissions = Schema::hasTable('insurance_commissions')
            ? DB::table('insurance_commissions')->where('tenant_id', $policy->tenant_id)->where('policy_id', $policyId)->whereNull('deleted_at')->get()
            : collect();
        $vouchers = Schema::hasTable('accounting_vouchers') && Schema::hasColumn('accounting_vouchers', 'policy_id')
            ? DB::table('accounting_vouchers')->where('tenant_id', $policy->tenant_id)->where('policy_id', $policyId)
                ->where('status', 'posted')->whereNull('reversal_of_id')->whereNull('deleted_at')->get()
            : collect();

        $this->line("{$action} cancel/archive policy {$policyId} tenant {$policy->tenant_id} vehicle {$policy->vehicle_id}");
        foreach ($commissions as $commission) {
            $this->line("{$action} cancel commission {$commission->id} and record reversal gross {$commission->gross_commission} tds {$commission->tds_amount} net {$commission->net_receivable} received {$commission->received_amount}");
        }
        foreach ($vouchers as $voucher) $this->line("{$action} reverse posted accounting voucher {$voucher->id}");
    }

    private function repairPolicy(string $policyId): void
    {
        $policy = DB::table('vehicle_insurances')->where('id', $policyId)->lockForUpdate()->first();
        if (! $policy) return;

        $reason = 'Integrity repair: linked vehicle is missing or deleted.';
        $now = now();
        $commission = Schema::hasTable('insurance_commissions')
            ? DB::table('insurance_commissions')->where('tenant_id', $policy->tenant_id)->where('policy_id', $policyId)
                ->whereNull('deleted_at')->lockForUpdate()->first()
            : null;

        if ($commission && Schema::hasTable('insurance_commission_reversals')) {
            $reversal = DB::table('insurance_commission_reversals')->where('tenant_id', $policy->tenant_id)->where('policy_id', $policyId)->first();
            $values = [
                'commission_id' => $commission->id,
                'reversal_date' => $now->toDateString(),
                'gross_commission' => -abs((float) $commission->gross_commission),
                'tds_amount' => -abs((float) $commission->tds_amount),
                'net_receivable' => -abs((float) $commission->net_receivable),
                'received_amount' => -abs((float) $commission->received_amount),
                'reason' => $reason,
                'updated_at' => $now,
            ];
            if ($reversal) {
                DB::table('insurance_commission_reversals')->where('id', $reversal->id)->update($values);
            } else {
                DB::table('insurance_commission_reversals')->insert($values + [
                    'id' => (string) Str::uuid(), 'tenant_id' => $policy->tenant_id,
                    'policy_id' => $policyId, 'created_by' => null, 'created_at' => $now,
                ]);
            }
        }

        if ($commission) DB::table('insurance_commissions')->where('id', $commission->id)->where('tenant_id', $policy->tenant_id)->update([
            'status' => 'cancelled',
            'remarks' => trim(($commission->remarks ? $commission->remarks."\n" : '').'Reversed by integrity repair: '.$reason),
            'updated_at' => $now,
        ]);

        $this->reverseAccounting($policy->tenant_id, $policyId, $now->toDateString(), $reason);
        DB::table('vehicle_insurances')->where('id', $policyId)->where('tenant_id', $policy->tenant_id)->update([
            'status' => 'cancelled', 'archived_at' => $policy->archived_at ?? $now,
            'cancelled_at' => $policy->cancelled_at ?? $now,
            'cancellation_reason' => $policy->cancellation_reason ?: $reason,
            'updated_at' => $now,
        ]);
    }

    private function reverseAccounting(string $tenantId, string $policyId, string $date, string $reason): void
    {
        if (! Schema::hasTable('accounting_vouchers') || ! Schema::hasColumn('accounting_vouchers', 'policy_id')) return;
        $vouchers = DB::table('accounting_vouchers')->where('tenant_id', $tenantId)->where('policy_id', $policyId)
            ->where('status', 'posted')->whereNull('reversal_of_id')->whereNull('deleted_at')->lockForUpdate()->get();
        foreach ($vouchers as $voucher) {
            if (DB::table('accounting_vouchers')->where('tenant_id', $tenantId)->where('reversal_of_id', $voucher->id)->exists()) continue;
            $reversalId = (string) Str::uuid();
            DB::table('accounting_vouchers')->insert([
                'id' => $reversalId, 'tenant_id' => $tenantId, 'policy_id' => $policyId, 'reversal_of_id' => $voucher->id,
                'voucher_number' => 'REV-'.substr(str_replace('-', '', $voucher->id), 0, 16), 'voucher_type' => 'journal',
                'voucher_date' => $date, 'reference_number' => $voucher->voucher_number,
                'narration' => 'Integrity repair reversal: '.$reason, 'total_debit' => $voucher->total_credit,
                'total_credit' => $voucher->total_debit, 'status' => 'posted', 'created_by' => null, 'updated_by' => null,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            foreach (DB::table('accounting_voucher_entries')->where('tenant_id', $tenantId)->where('voucher_id', $voucher->id)->get() as $entry) {
                DB::table('accounting_voucher_entries')->insert([
                    'id' => (string) Str::uuid(), 'tenant_id' => $tenantId, 'voucher_id' => $reversalId,
                    'ledger_id' => $entry->ledger_id, 'entry_type' => $entry->entry_type === 'debit' ? 'credit' : 'debit',
                    'amount' => $entry->amount, 'description' => 'Reversal: '.($entry->description ?? $reason),
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
    }
}
