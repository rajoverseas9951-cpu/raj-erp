<?php

namespace App\Features\Ocr\Controllers;

use App\Features\Ocr\Services\OcrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class PublicPolicyOcrController
{
    public function __construct(private OcrService $ocr) {}

    public function __invoke(Request $request): JsonResponse
    {
        $configuredToken = trim((string) config('services.paddleocr.public_token'));
        $providedToken = trim((string) $request->header('X-Vimawallah-OCR-Token', ''));
        $source = trim((string) $request->header('X-Vimawallah-Source', ''));

        $validToken = $configuredToken !== ''
            && $providedToken !== ''
            && hash_equals($configuredToken, $providedToken);
        $validWebsiteSource = hash_equals('policy-analyzer', $source);

        if (! $validToken && ! $validWebsiteSource) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized OCR request.',
            ], 401);
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
                // Paddle service currently exposes RC OCR, but raw OCR text is generic
                // and is parsed as a policy only on the website side.
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
            'overall_confidence' => $confidences === []
                ? 0
                : round(array_sum($confidences) / count($confidences), 4),
            'warnings' => array_values(array_unique($warnings)),
        ]);
    }
}
