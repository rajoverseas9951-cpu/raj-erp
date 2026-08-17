<?php

use App\Features\BugAgent\Services\BugAgentService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Str;

Artisan::command('bug-agent:scan', function (BugAgentService $agent) {
    $findings = $agent->scheduledFindings();

    foreach ($findings as $finding) {
        DB::table('bug_agent_reports')->insert([
            'id' => (string) Str::uuid(),
            'tenant_id' => null,
            'source' => 'scan',
            'title' => $finding['title'],
            'description' => $finding['detail'],
            'severity' => $finding['severity'],
            'category' => $finding['category'],
            'status' => in_array($finding['severity'], ['high', 'critical'], true) ? 'needs_review' : 'triaged',
            'confidence' => 100,
            'diagnosis' => $finding['detail'],
            'root_cause' => 'Detected by deterministic ERP health checks.',
            'suggested_fix' => 'Review the affected subsystem and logs before applying changes.',
            'auto_fix_eligible' => false,
            'detected_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    $this->info($findings === [] ? 'Bug Agent scan healthy.' : count($findings).' finding(s) recorded.');
})->purpose('Scan ERP runtime and data consistency for bugs');

Schedule::command('bug-agent:scan')
    ->cron('0 7,10,13,16,19,22 * * *')
    ->timezone('Asia/Kolkata')
    ->withoutOverlapping();
