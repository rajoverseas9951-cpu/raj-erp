<?php

namespace App\Features\Ocr\Controllers;

use App\Features\Ocr\Services\OcrService;
use App\Features\Vehicles\Services\VehicleMasterResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class OcrController
{
    public function __construct(
        private OcrService $ocr,
        private VehicleMasterResolver $masters,
    ) {}

    public function publicPolicyScan(Request $request): JsonResponse
    {
        $configuredToken = trim((string) config('services.paddleocr.public_token'));
        $providedToken = trim((string) $request->header('X-Vimawallah-OCR-Token', ''));
        $source = trim((string) $request->header('X-Vimawallah-Source', ''));

        if ($configuredToken !== '') {
            if ($providedToken === '' || ! hash_equals($configuredToken, $providedToken)) {
                return response()->json(['success' => false, 'message' => 'Unauthorized OCR request.'], 401);
            }
        } elseif ($source !== 'policy-analyzer') {
            return response()->json(['success' => false, 'message' => 'Unauthorized OCR request.'], 401);
        }

        $validated = $request->validate([
            'images' => ['required', 'array', 'between:1,4'],
            'images.*' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
        ]);

        $texts = [];
        $warnings = [];
        $confidences = [];

        try {
            foreach ($validated['images'] as $image) {
                $data = $this->ocr->scan([$image], 'rc');
                $text = trim((string) ($data['text'] ?? ''));
                if ($text !== '') {
                    $texts[] = $text;
                }
                foreach (($data['warnings'] ?? []) as $warning) {
                    if (is_string($warning) && trim($warning) !== '') {
                        $warnings[] = trim($warning);
                    }
                }
                if (is_numeric($data['overall_confidence'] ?? null)) {
                    $confidences[] = (float) $data['overall_confidence'];
                }
            }
        } catch (RuntimeException $exception) {
            report($exception);

            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 502);
        }

        return response()->json([
            'success' => true,
            'engine' => 'PaddleOCR PP-OCRv5',
            'raw_text' => trim(implode("\n\n", $texts)),
            'overall_confidence' => $confidences === [] ? 0 : round(array_sum($confidences) / count($confidences), 4),
            'warnings' => array_values(array_unique($warnings)),
        ]);
    }

    public function scan(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'document_type' => ['required', Rule::in(['rc', 'aadhaar', 'insurance_policy'])],
            'images' => ['required', 'array', 'between:1,2'],
            'images.*' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:15360'],
        ]);

        if ($validated['document_type'] === 'rc') {
            $totalBytes = array_sum(array_map(
                fn ($image) => (int) ($image->getSize() ?: 0),
                $validated['images']
            ));
            $containsPdf = collect($validated['images'])->contains(
                fn ($image) => strtolower($image->getClientOriginalExtension()) === 'pdf'
            );
            if ($totalBytes > 15 * 1024 * 1024) {
                throw ValidationException::withMessages(['images' => 'RC images may not exceed 15 MB in total.']);
            }
            if ($containsPdf) {
                throw ValidationException::withMessages(['images' => 'RC OCR accepts JPG, JPEG, PNG, or WEBP images only.']);
            }
        }

        try {
            $data = $this->ocr->scan($validated['images'], $validated['document_type']);
            if ($validated['document_type'] === 'rc') {
                $resolution = $this->masters->resolveOcrFields(
                    $data['fields'],
                    (string) $request->user()?->tenant_id,
                    $request->user()?->id,
                    $data['field_confidence'] ?? [],
                );
                $data['fields'] = $resolution['fields'];
                $data['masters'] = $resolution['masters'];
                $data['warnings'] = array_values(array_unique(array_merge(
                    $data['warnings'] ?? [],
                    $resolution['warnings'] ?? [],
                )));
                Log::debug('ocr.rc.response_ready', [
                    'fields' => $data['fields'],
                    'field_confidence' => $data['field_confidence'] ?? [],
                    'resolved_master_ids' => array_filter(
                        $data['fields'],
                        fn ($value, $field) => str_ends_with((string) $field, '_id') && $value !== '',
                        ARRAY_FILTER_USE_BOTH,
                    ),
                    'warnings' => $data['warnings'],
                ]);
            }
        } catch (RuntimeException $exception) {
            report($exception);

            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], str_contains($exception->getMessage(), 'not configured') ? 503 : 502);
        }

        return response()->json(['success' => true, 'data' => $data]);
    }
}
