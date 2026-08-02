<?php

namespace App\Console\Commands;

use App\Support\DataIntegrityInspector;
use Illuminate\Console\Command;

class CheckDataIntegrity extends Command
{
    protected $signature = 'data:check-integrity';
    protected $description = 'Report orphaned or inconsistent ERP records without changing data';

    public function handle(DataIntegrityInspector $inspector): int
    {
        $issues = $inspector->inspect();
        foreach ($issues as $name => $ids) {
            $this->line(str_replace('_', ' ', $name).': '.count($ids));
            foreach ($ids as $id) $this->line("  - {$id}");
        }
        $this->info('Integrity check complete. No data was changed.');
        return self::SUCCESS;
    }
}
