<?php

namespace App\Features\BugAgent\Services;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class BugAgentService
{
    private const SAFE_ACTIONS = ['clear_application_cache'];

    public function analyzeReport(object $report): array
    {
        $apiKey = (string) config('services.openai.key');
        if ($apiKey === '') {
            return [
                'severity' => 'unknown',
                'category' => 'configuration',
                'status' => 'needs_configuration',
                'confidence' => 1,
                'diagnosis' => 'Bug report saved, but AI analysis is not active because OPENAI_API_KEY is not configured on the ERP server.',
                'root_cause' => 'Missing OpenAI API credential.',
                'suggested_fix' => 'Configure OPENAI_API_KEY on the production backend, then re-run analysis.',
                'auto_fix_eligible' => false,
                'auto_fix_action' => null,
                'ai_model' => null,
            ];
        }

        $content = [[
            'type' => 'input_text',
            'text' => $this->analysisPrompt($report),
        ]];

        if (! empty($report->screenshot_path) && Storage::disk('local')->exists($report->screenshot_path)) {
            $bytes = Storage::disk('local')->get($report->screenshot_path);
            $mime = $this->mimeFor($report->screenshot_path);
            $content[] = [
                'type' => 'input_image',
                'image_url' => 'data:'.$mime.';base64,'.base64_encode($bytes),
            ];
        }

        $model = (string) config('services.openai.bug_agent_model', 'gpt-5.6-terra');
        $response = Http::withToken($apiKey)
            ->acceptJson()
            ->timeout(90)
            ->post('https://api.openai.com/v1/responses', [
                'model' => $model,
                'reasoning' => ['effort' => 'low'],
                'input' => [[
                    'role' => 'user',
                    'content' => $content,
                ]],
                'max_output_tokens' => 1800,
            ]);

        if (! $response->successful()) {
            throw new RuntimeException('Bug Agent AI request failed with HTTP '.$response->status().'.');
        }

        $raw = $response->json();
        $text = $this->extractOutputText($raw);
        $parsed = $this->decodeJson($text);
        $severity = strtolower((string) ($parsed['severity'] ?? 'unknown'));
        if (! in_array($severity, ['low', 'medium', 'high', 'critical', 'unknown'], true)) $severity = 'unknown';

        $action = (string) ($parsed['auto_fix_action'] ?? '');
        $eligible = (bool) ($parsed['auto_fix_eligible'] ?? false) && in_array($action, self::SAFE_ACTIONS, true);

        return [
            'severity' => $severity,
            'category' => Str::limit((string) ($parsed['category'] ?? 'general'), 80, ''),
            'status' => $severity === 'critical' || $severity === 'high' ? 'needs_review' : 'triaged',
            'confidence' => max(0, min(100, (float) ($parsed['confidence'] ?? 0))),
            'diagnosis' => (string) ($parsed['diagnosis'] ?? $text),
            'root_cause' => (string) ($parsed['root_cause'] ?? ''),
            'suggested_fix' => (string) ($parsed['suggested_fix'] ?? ''),
            'auto_fix_eligible' => $eligible,
            'auto_fix_action' => $eligible ? $action : null,
            'ai_model' => $model,
            'raw_response' => $raw,
        ];
    }

    public function runSafeFix(object $report): array
    {
        $action = (string) ($report->auto_fix_action ?? '');
        if (! $report->auto_fix_eligible || ! in_array($action, self::SAFE_ACTIONS, true)) {
            throw new RuntimeException('This issue is not eligible for a safe automatic fix.');
        }

        if ($action === 'clear_application_cache') {
            Artisan::call('optimize:clear');
            return ['action' => $action, 'message' => 'Laravel application caches cleared safely.'];
        }

        throw new RuntimeException('Unsupported safe fix action.');
    }

    public function scheduledFindings(): array
    {
        $findings = [];

        try {
            DB::select('select 1');
        } catch (\Throwable $e) {
            $findings[] = ['severity' => 'critical', 'category' => 'database', 'title' => 'Database health check failed', 'detail' => $e->getMessage()];
        }

        $log = storage_path('logs/laravel.log');
        if (is_file($log)) {
            $size = filesize($log) ?: 0;
            $fh = fopen($log, 'rb');
            if ($fh) {
                fseek($fh, max(0, $size - 60000));
                $tail = (string) stream_get_contents($fh);
                fclose($fh);
                $lines = preg_split('/\R/', $tail) ?: [];
                $errors = array_values(array_filter($lines, fn ($line) => str_contains($line, '.ERROR:') || str_contains($line, 'local.ERROR') || str_contains($line, 'production.ERROR')));
                if ($errors !== []) {
                    $findings[] = [
                        'severity' => count($errors) >= 5 ? 'high' : 'medium',
                        'category' => 'runtime',
                        'title' => 'Recent backend errors detected',
                        'detail' => implode("\n", array_slice($errors, -8)),
                    ];
                }
            }
        }

        if (DB::getSchemaBuilder()->hasTable('vehicles') && DB::getSchemaBuilder()->hasColumn('vehicles', 'payment_due')) {
            $negative = DB::table('vehicles')->where('payment_due', '<', 0)->count();
            if ($negative > 0) {
                $findings[] = ['severity' => 'medium', 'category' => 'data_consistency', 'title' => 'Negative vehicle outstanding detected', 'detail' => $negative.' vehicle record(s) have payment_due below zero.'];
            }
        }

        return $findings;
    }

    private function analysisPrompt(object $report): string
    {
        return <<<PROMPT
You are the internal Bug Agent for a production insurance/RTO ERP. Analyze the supplied user screenshot and report carefully.

Return ONLY valid JSON with these keys:
severity: one of low, medium, high, critical
category: short technical category
confidence: number 0-100
diagnosis: concise explanation of what is visibly or technically wrong
root_cause: most likely root cause; say uncertain when evidence is insufficient
suggested_fix: concrete developer action, including likely frontend/backend area if inferable
auto_fix_eligible: boolean
auto_fix_action: either "clear_application_cache" or null

Rules:
- Never claim a code change is proven from a screenshot alone.
- Major, financial, authentication, permissions, database, policy/insurance calculation, or destructive bugs are NEVER auto-fix eligible.
- Only use clear_application_cache when evidence strongly points to stale cached routes/config/views after a deployment. Otherwise auto_fix_eligible=false.
- Prefer evidence from visible UI text, dates, values, error messages, URL and the user's description.

Title: {$report->title}
Description: {$report->description}
Page URL: {$report->page_url}
PROMPT;
    }

    private function extractOutputText(array $raw): string
    {
        foreach (($raw['output'] ?? []) as $item) {
            foreach (($item['content'] ?? []) as $content) {
                if (($content['type'] ?? null) === 'output_text' && isset($content['text'])) return (string) $content['text'];
            }
        }
        return (string) ($raw['output_text'] ?? '');
    }

    private function decodeJson(string $text): array
    {
        $clean = trim($text);
        $clean = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', $clean) ?? $clean;
        $decoded = json_decode($clean, true);
        if (! is_array($decoded)) {
            throw new RuntimeException('Bug Agent returned an unreadable analysis response.');
        }
        return $decoded;
    }

    private function mimeFor(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            default => 'image/png',
        };
    }
}
