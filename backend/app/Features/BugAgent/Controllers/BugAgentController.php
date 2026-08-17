<?php

namespace App\Features\BugAgent\Controllers;

use App\Features\BugAgent\Services\BugAgentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class BugAgentController
{
    public function index(Request $request)
    {
        $this->admin($request);
        $tenant = (string) $request->user()?->tenant_id;
        $rows = DB::table('bug_agent_reports')
            ->where(fn ($q) => $q->where('tenant_id', $tenant)->orWhereNull('tenant_id'))
            ->latest('created_at')
            ->limit(100)
            ->get()
            ->map(fn ($row) => $this->present($row));

        $counts = DB::table('bug_agent_reports')
            ->where(fn ($q) => $q->where('tenant_id', $tenant)->orWhereNull('tenant_id'))
            ->selectRaw("COUNT(*) total, SUM(CASE WHEN status IN ('needs_review','triaged','analyzing','analysis_failed') THEN 1 ELSE 0 END) open_count, SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) critical_count, SUM(CASE WHEN auto_fix_eligible = 1 THEN 1 ELSE 0 END) safe_fix_count")
            ->first();

        return response()->json(['success' => true, 'data' => [
            'reports' => $rows,
            'stats' => [
                'total' => (int) ($counts->total ?? 0),
                'open' => (int) ($counts->open_count ?? 0),
                'critical' => (int) ($counts->critical_count ?? 0),
                'safe_fix' => (int) ($counts->safe_fix_count ?? 0),
            ],
        ]]);
    }

    public function store(Request $request, BugAgentService $agent)
    {
        $this->admin($request);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'description' => ['nullable', 'string', 'max:4000'],
            'page_url' => ['nullable', 'string', 'max:2000'],
            'screenshot' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:12288'],
        ]);

        $id = (string) Str::uuid();
        $tenant = (string) $request->user()?->tenant_id;
        $file = $request->file('screenshot');
        $path = $file->store("tenants/{$tenant}/bug-agent/{$id}", 'local');
        $now = now();

        DB::table('bug_agent_reports')->insert([
            'id' => $id,
            'tenant_id' => $tenant,
            'source' => 'upload',
            'title' => trim($data['title']),
            'description' => $data['description'] ?? null,
            'page_url' => $data['page_url'] ?? null,
            'screenshot_path' => $path,
            'severity' => 'unknown',
            'status' => 'analyzing',
            'created_by' => $request->user()?->id,
            'detected_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        try {
            $report = DB::table('bug_agent_reports')->where('id', $id)->first();
            $analysis = $agent->analyzeReport($report);
            DB::table('bug_agent_reports')->where('id', $id)->update(array_merge($analysis, [
                'raw_response' => isset($analysis['raw_response']) ? json_encode($analysis['raw_response']) : null,
                'updated_at' => now(),
            ]));
        } catch (\Throwable $e) {
            DB::table('bug_agent_reports')->where('id', $id)->update([
                'status' => 'analysis_failed',
                'diagnosis' => 'Screenshot was saved but AI analysis failed.',
                'root_cause' => Str::limit($e->getMessage(), 1500),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['success' => true, 'data' => $this->present(DB::table('bug_agent_reports')->where('id', $id)->first())], 201);
    }

    public function analyze(Request $request, string $report, BugAgentService $agent)
    {
        $this->admin($request);
        $row = $this->report($request, $report);
        $analysis = $agent->analyzeReport($row);
        DB::table('bug_agent_reports')->where('id', $row->id)->update(array_merge($analysis, [
            'raw_response' => isset($analysis['raw_response']) ? json_encode($analysis['raw_response']) : null,
            'updated_at' => now(),
        ]));
        return response()->json(['success' => true, 'data' => $this->present(DB::table('bug_agent_reports')->where('id', $row->id)->first())]);
    }

    public function safeFix(Request $request, string $report, BugAgentService $agent)
    {
        $this->admin($request);
        $row = $this->report($request, $report);
        $result = $agent->runSafeFix($row);
        DB::table('bug_agent_reports')->where('id', $row->id)->update([
            'status' => 'resolved',
            'resolved_at' => now(),
            'updated_at' => now(),
        ]);
        return response()->json(['success' => true, 'data' => ['report' => $this->present(DB::table('bug_agent_reports')->where('id', $row->id)->first()), 'result' => $result]]);
    }

    public function resolve(Request $request, string $report)
    {
        $this->admin($request);
        $row = $this->report($request, $report);
        DB::table('bug_agent_reports')->where('id', $row->id)->update(['status' => 'resolved', 'resolved_at' => now(), 'updated_at' => now()]);
        return response()->json(['success' => true, 'data' => $this->present(DB::table('bug_agent_reports')->where('id', $row->id)->first())]);
    }

    public function screenshot(Request $request, string $report)
    {
        $this->admin($request);
        $row = $this->report($request, $report);
        abort_unless($row->screenshot_path && Storage::disk('local')->exists($row->screenshot_path), 404);
        return Storage::disk('local')->response($row->screenshot_path);
    }

    public function scanNow(Request $request, BugAgentService $agent)
    {
        $this->admin($request);
        $tenant = (string) $request->user()?->tenant_id;
        $created = [];
        foreach ($agent->scheduledFindings() as $finding) {
            $id = (string) Str::uuid();
            DB::table('bug_agent_reports')->insert([
                'id' => $id,
                'tenant_id' => $tenant,
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
                'created_by' => $request->user()?->id,
                'detected_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $created[] = $this->present(DB::table('bug_agent_reports')->where('id', $id)->first());
        }
        return response()->json(['success' => true, 'data' => ['findings' => $created, 'healthy' => $created === []]]);
    }

    private function report(Request $request, string $id): object
    {
        $tenant = (string) $request->user()?->tenant_id;
        $row = DB::table('bug_agent_reports')->where('id', $id)->where(fn ($q) => $q->where('tenant_id', $tenant)->orWhereNull('tenant_id'))->first();
        abort_unless($row, 404);
        return $row;
    }

    private function present(object $row): array
    {
        $data = (array) $row;
        unset($data['screenshot_path'], $data['raw_response']);
        $data['has_screenshot'] = ! empty($row->screenshot_path);
        return $data;
    }

    private function admin(Request $request): void
    {
        abort_unless((bool) $request->user()?->is_admin, 403, 'Bug Agent is restricted to administrators.');
    }
}
