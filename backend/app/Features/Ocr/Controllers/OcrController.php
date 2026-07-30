<?php

namespace App\Features\Ocr\Controllers;

use App\Features\Ocr\Services\OcrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class OcrController
{
    public function __construct(private OcrService $ocr) {}

    public function scan(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'document_type' => ['required', Rule::in(['rc', 'aadhaar'])],
            'images' => ['required', 'array', 'between:1,2'],
            'images.*' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);

        try {
            $data = $this->ocr->scan($validated['images'], $validated['document_type']);
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
