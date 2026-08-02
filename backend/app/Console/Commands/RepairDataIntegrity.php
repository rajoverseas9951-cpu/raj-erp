<?php

namespace App\Console\Commands;

use App\Support\DataIntegrityInspector;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RepairDataIntegrity extends Command
{
    protected $signature = 'data:repair-integrity {--dry-run : Preview repairs (default)} {--apply : Apply non-destructive repairs}';
    protected $description = 'Preview or apply non-destructive integrity repairs; records are never deleted';

    public function handle(DataIntegrityInspector $inspector): int
    {
        $issues = $inspector->inspect();
        $apply = (bool) $this->option('apply');
        foreach ($issues as $name => $ids) foreach ($ids as $id) $this->line(($apply ? 'APPLY' : 'PROPOSE').' '.str_replace('_', ' ', $name)." {$id}");
        if (! $apply) { $this->info('Dry run complete. Re-run with --apply to make the listed non-destructive status/archive repairs.'); return self::SUCCESS; }
        DB::transaction(function () use ($issues) {
            $policies = array_unique(array_merge($issues['policies_with_missing_vehicles'], $issues['policies_linked_to_deleted_vehicles']));
            if ($policies) DB::table('vehicle_insurances')->whereIn('id', $policies)->update([
                'status' => 'cancelled', 'archived_at' => now(), 'cancellation_reason' => 'Integrity repair: linked vehicle is missing or deleted.', 'updated_at' => now(),
            ]);
            if ($issues['orphan_commissions']) DB::table('insurance_commissions')->whereIn('id', $issues['orphan_commissions'])->update([
                'status' => 'cancelled', 'remarks' => 'Integrity repair: linked policy is missing.', 'updated_at' => now(),
            ]);
        });
        $this->info('Non-destructive repairs applied. No records were deleted.');
        return self::SUCCESS;
    }
}
