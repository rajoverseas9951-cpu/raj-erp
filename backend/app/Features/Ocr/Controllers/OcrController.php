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
