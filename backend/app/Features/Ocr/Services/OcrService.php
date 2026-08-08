<?php

namespace App\Features\Ocr\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class OcrService
{
    /**
     * @param  array<int, UploadedFile>  $images
     * @return array{text:string,texts:array<int,string>,fields:array<string,string>,field_confidence?:array<string,float>,overall_confidence?:float,warnings?:array<int,string>}
     */
    public function scan(array $images, string $documentType): array
    {
        if ($documentType === 'rc') {
            return $this->scanRcWithPaddle($images);
        }

        $key = trim((string) config('services.ocr_space.key'));

        if ($key === '') {
            throw new RuntimeException('OCR.Space is not configured. Set OCR_SPACE_API_KEY.');
        }

        $texts = [];
        foreach ($images as $image) {
            $texts[] = $this->readImage($image, $key);
        }

        $text = trim(implode("\n", $texts));

        return [
            'text' => $text,
            'texts' => $texts,
            'fields' => match ($documentType) {
                'insurance_policy' => $this->parsePolicy($text),
                default => [],
            },
        ];
    }

    /**
     * @param  array<int, UploadedFile>  $images
     * @return array{text:string,texts:array<int,string>,fields:array<string,string>,field_confidence:array<string,float>,overall_confidence:float,warnings:array<int,string>}
     */
    private function scanRcWithPaddle(array $images): array
    {
        $baseUrl = rtrim(trim((string) config('services.paddleocr.url')), '/');
        if ($baseUrl === '') {
            throw new RuntimeException('PaddleOCR is not configured. Set PADDLEOCR_URL.');
        }

        $request = Http::acceptJson()
            ->connectTimeout(5)
            ->timeout((int) config('services.paddleocr.timeout', 100));
        $streams = [];

        try {
            foreach (array_values($images) as $index => $image) {
                $field = count($images) === 1 ? 'combined' : ($index === 0 ? 'front' : 'back');
                $stream = fopen($image->getRealPath(), 'r');
                if ($stream === false) {
                    throw new RuntimeException('The uploaded RC image could not be read.');
                }
                $streams[] = $stream;
                $request = $request->attach(
                    $field,
                    $stream,
                    $image->getClientOriginalName(),
                    ['Content-Type' => $image->getMimeType() ?: 'application/octet-stream']
                );
            }

            $response = $request->post($baseUrl.'/v1/ocr/rc');
        } catch (ConnectionException $exception) {
            throw new RuntimeException('The internal PaddleOCR service could not be reached. Please try again.', previous: $exception);
        } finally {
            foreach ($streams as $stream) {
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }
        }

        $payload = $response->json();
        if (! $response->successful()) {
            $detail = is_array($payload) && is_string($payload['detail'] ?? null)
                ? trim($payload['detail'])
                : '';
            throw new RuntimeException($detail !== ''
                ? 'PaddleOCR could not process the RC: '.$detail
                : "PaddleOCR request failed with status {$response->status()}.");
        }
        if (! is_array($payload) || ($payload['success'] ?? false) !== true || ! is_array($payload['fields'] ?? null)) {
            throw new RuntimeException('PaddleOCR returned an invalid response.');
        }

        $text = is_string($payload['raw_text'] ?? null) ? trim($payload['raw_text']) : '';
        $textsBySource = [];
        foreach (is_array($payload['ocr_lines'] ?? null) ? $payload['ocr_lines'] : [] as $line) {
            if (! is_array($line) || ! is_string($line['text'] ?? null)) {
                continue;
            }
            $source = is_string($line['source'] ?? null) ? $line['source'] : 'combined';
            $textsBySource[$source][] = trim($line['text']);
        }
        $texts = array_values(array_map(
            fn (array $lines) => trim(implode("\n", array_filter($lines))),
            $textsBySource
        ));
        if ($texts === [] && $text !== '') {
            $texts = [$text];
        }

        $mappedFields = $this->mapPaddleRcFields($payload['fields']);
        $mappedConfidence = $this->mapPaddleRcConfidence(
            is_array($payload['field_confidence'] ?? null) ? $payload['field_confidence'] : []
        );
        $contextWarnings = $this->applyVehicleContext($mappedFields, $mappedConfidence);
        Log::debug('ocr.rc.fields_normalized', [
            'extracted_fields' => $payload['fields'],
            'normalized_fields' => $mappedFields,
            'low_confidence_fields' => array_keys(array_filter(
                $mappedConfidence,
                fn (float $confidence) => $confidence < 0.8
            )),
        ]);

        return [
            'text' => $text,
            'texts' => $texts,
            'fields' => $mappedFields,
            'field_confidence' => $mappedConfidence,
            'overall_confidence' => is_numeric($payload['overall_confidence'] ?? null) ? (float) $payload['overall_confidence'] : 0.0,
            'warnings' => array_values(array_unique(array_merge(
                array_values(array_filter(
                    is_array($payload['warnings'] ?? null) ? $payload['warnings'] : [],
                    fn ($warning) => is_string($warning) && trim($warning) !== ''
                )),
                $contextWarnings,
            ))),
        ];
    }

    /** @param array<string, mixed> $source @return array<string, string> */
    private function mapPaddleRcFields(array $source): array
    {
        $fields = [];
        foreach ([
            'vehicle_number', 'registration_authority', 'chassis_number', 'engine_number',
            'owner_name', 'father_or_spouse_name', 'ownership_type', 'address',
            'manufacturer', 'model', 'vehicle_class', 'body_type', 'colour', 'financier',
        ] as $key) {
            $value = $source[$key] ?? null;
            if (is_string($value) && trim($value) !== '') {
                $fields[$key] = trim($value);
            }
        }

        if (isset($fields['vehicle_number'])) {
            $fields['vehicle_number'] = $this->identifier($fields['vehicle_number']);
        }
        foreach (['chassis_number', 'engine_number'] as $key) {
            if (isset($fields[$key])) {
                $fields[$key] = $this->identifier($fields[$key]);
            }
        }
        foreach ([
            'owner_name', 'father_or_spouse_name', 'ownership_type', 'manufacturer',
            'model', 'vehicle_class', 'body_type', 'colour',
            'registration_authority', 'financier',
        ] as $key) {
            if (isset($fields[$key])) {
                $fields[$key] = strtoupper($this->clean($fields[$key]));
            }
        }
        if (isset($fields['model'])) {
            $fields['model'] = $this->normaliseModel($fields['model']);
        }
        if (isset($fields['manufacturer'])) {
            $fields['manufacturer'] = (string) preg_replace(
                '/\bSUZUKIINDIA\b/i',
                'SUZUKI INDIA',
                $fields['manufacturer']
            );
        }
        if (isset($fields['body_type'])) {
            $fields['body_type'] = $this->collapseRepeatedAdjacentPhrase($fields['body_type']);
        }
        if (isset($fields['body_type'])) {
            $fields['vehicle_category'] = $fields['body_type'];
            unset($fields['body_type']);
        }
        if (isset($fields['registration_authority'])) {
            $fields['district'] = $fields['registration_authority'];
        }
        if (str_starts_with($fields['vehicle_number'] ?? '', 'GJ')) {
            $fields['state'] = 'Gujarat';
        }

        $registrationDate = $source['registration_date'] ?? null;
        if (is_string($registrationDate) && ($date = $this->normaliseDate($registrationDate))) {
            $fields['registration_date'] = $date;
        }
        $fuel = $source['fuel_type'] ?? null;
        if (is_string($fuel) && trim($fuel) !== '') {
            $normalisedFuel = $this->normaliseFuel($fuel);
            if ($normalisedFuel !== null) {
                $fields['fuel_type'] = $normalisedFuel;
            }
        }

        foreach ([
            'seating_capacity' => 'seating_capacity',
            'cubic_capacity' => 'cubic_capacity',
            'unladen_weight' => 'unladen_weight',
            'gross_vehicle_weight' => 'gross_weight',
            'number_of_cylinders' => 'number_of_cylinders',
        ] as $sourceKey => $targetKey) {
            $value = $source[$sourceKey] ?? null;
            if (is_string($value) && ($number = $this->normaliseNumericField($sourceKey, $value)) !== null) {
                $fields[$targetKey] = $number;
            }
        }

        $manufacturingYear = $source['manufacturing_year'] ?? null;
        if (is_string($manufacturingYear) && preg_match('/\b(?:19|20)\d{2}\b/', $manufacturingYear, $match)) {
            $fields['manufacturing_year'] = $match[0];
        } else {
            $manufactured = $source['manufacturing_month_year'] ?? null;
            if (is_string($manufactured) && preg_match('/\b(?:19|20)\d{2}\b/', $manufactured, $match)) {
                $fields['manufacturing_year'] = $match[0];
            }
        }

        $class = strtolower($fields['vehicle_class'] ?? '');
        if (preg_match('/m-?cycle|motor\s*cycle|scooter|2wn|two\s*wheeler/', $class)) {
            $fields['vehicle_type'] = 'two_wheeler';
        } elseif (preg_match('/hgv|heavy\s*goods|truck|trailer/', $class)) {
            $fields['vehicle_type'] = 'hgv';
        } elseif (preg_match('/lgv|light\s*goods|pickup/', $class)) {
            $fields['vehicle_type'] = 'lgv';
        } elseif (preg_match('/taxi|cab|maxi|passenger/', $class)) {
            $fields['vehicle_type'] = 'taxi';
        } elseif (preg_match('/motor\s*car|private\s*car|\blmv\b/', $class)) {
            $fields['vehicle_type'] = 'private_car';
        }

        return array_filter($fields, fn ($value) => $value !== '');
    }

    /** @param array<string, mixed> $source @return array<string, float> */
    private function mapPaddleRcConfidence(array $source): array
    {
        $mapping = [
            'body_type' => ['vehicle_category'],
            'manufacturing_month_year' => ['manufacturing_year'],
            'gross_vehicle_weight' => ['gross_weight'],
        ];
        $allowed = [
            'vehicle_number', 'registration_date', 'registration_authority', 'chassis_number',
            'engine_number', 'owner_name', 'father_or_spouse_name', 'ownership_type', 'address',
            'manufacturer', 'model', 'vehicle_class', 'vehicle_category', 'body_type', 'colour',
            'financier', 'fuel_type', 'seating_capacity', 'cubic_capacity', 'unladen_weight',
            'gross_weight', 'number_of_cylinders', 'manufacturing_year', 'state', 'district',
            'vehicle_type',
        ];
        $confidence = [];
        foreach ($source as $field => $value) {
            if (! is_string($field) || ! is_numeric($value)) {
                continue;
            }
            foreach ($mapping[$field] ?? [$field] as $target) {
                if (! in_array($target, $allowed, true)) {
                    continue;
                }
                $confidence[$target] = max(0.0, min(1.0, (float) $value));
            }
        }

        return $confidence;
    }

    private function normaliseModel(string $value): string
    {
        $value = (string) preg_replace('/\s*\([^()]{1,30}\)\s*$/', '', $value);
        $value = str_replace('+', ' PLUS ', $value);
        $value = (string) preg_replace('/(?<=\d)(?=[A-Z]{2,}\b)/i', ' ', $value);

        return strtoupper($this->clean($value));
    }

    private function normaliseNumericField(string $field, string $value): ?string
    {
        if (! preg_match('/^\s*(\d+(?:\.\d+)?)\s*(?:CC|KG|KGS|CYLINDERS?)?\s*$/i', $value, $match)) {
            return null;
        }
        $number = (float) $match[1];
        $valid = match ($field) {
            'seating_capacity' => $number >= 1 && $number <= 100 && floor($number) === $number,
            'cubic_capacity' => $number >= 20 && $number <= 20_000,
            'unladen_weight', 'gross_vehicle_weight' => $number >= 20 && $number <= 100_000,
            'number_of_cylinders' => $number >= 1 && $number <= 16 && floor($number) === $number,
            default => false,
        };

        if (! $valid) {
            return null;
        }
        if (str_contains($match[1], '.')) {
            [$integer, $fraction] = explode('.', $match[1], 2);

            return ((string) ((int) $integer)).'.'.$fraction;
        }

        return (string) ((int) $match[1]);
    }

    private function collapseRepeatedAdjacentPhrase(string $value): string
    {
        $tokens = preg_split('/\s+/', trim($value)) ?: [];
        if (count($tokens) > 0 && count($tokens) % 2 === 0) {
            $midpoint = intdiv(count($tokens), 2);
            $first = array_slice($tokens, 0, $midpoint);
            $second = array_slice($tokens, $midpoint);
            if (array_map('strtoupper', $first) === array_map('strtoupper', $second)) {
                return implode(' ', $first);
            }
        }

        return $value;
    }

    /**
     * @param  array<string, string>  $fields
     * @param  array<string, float>  $confidence
     * @return array<int, string>
     */
    private function applyVehicleContext(array &$fields, array &$confidence): array
    {
        $warnings = [];
        $tractorEvidence = [
            'vehicle_class' => $fields['vehicle_class'] ?? '',
            'vehicle_category' => $fields['vehicle_category'] ?? '',
            'manufacturer' => $fields['manufacturer'] ?? '',
            'model' => $fields['model'] ?? '',
        ];
        $tractorContext = strtoupper(implode(' ', $tractorEvidence));
        $tractorConfidence = max(array_map(
            fn (string $field) => (float) ($confidence[$field] ?? 0.0),
            array_keys($tractorEvidence)
        ));
        $hasTractorIndicator = preg_match(
            '/\bTRACTOR\b|\bFARMTRAC\s*\d*\b|\bPOWERTRAC\s*\d*\b|'
            .'\bESCORTS\b|\bSONALIKA\b|\bJOHN\s+DEERE\b|\bDEUTZ\b|\bKUBOTA\b|'
            .'\bNEW\s+HOLLAND\b|\bEICHER\s+TRACTOR\b/',
            $tractorContext
        ) === 1;
        $isTractor = $hasTractorIndicator && $tractorConfidence >= 0.65;

        if (isset($fields['vehicle_type']) && ! isset($confidence['vehicle_type'])) {
            $confidence['vehicle_type'] = max(
                (float) ($confidence['vehicle_class'] ?? 0.0),
                (float) ($confidence['vehicle_category'] ?? 0.0),
            );
        }

        if ($isTractor) {
            $fields['vehicle_type'] = 'tractor';
            $confidence['vehicle_type'] = $tractorConfidence;

            $fuelConfidence = (float) ($confidence['fuel_type'] ?? 0.0);
            if (! isset($fields['fuel_type']) || $fuelConfidence < 0.55) {
                $fields['fuel_type'] = 'DIESEL';
                $confidence['fuel_type'] = 0.70;
                $warnings[] = 'Fuel Type was suggested as DIESEL from reliable tractor context; verify before saving.';
            }
        }

        if (! isset($fields['manufacturing_year']) && isset($fields['registration_date'])
            && preg_match('/\b((?:19|20)\d{2})\b/', $fields['registration_date'], $match)) {
            $fields['manufacturing_year'] = $match[1];
            $confidence['manufacturing_year'] = min(
                0.55,
                (float) ($confidence['registration_date'] ?? 0.55)
            );
            $warnings[] = 'Manufacturing Year was suggested from Registration Date because the RC manufacturing field was unreadable.';
        }

        return $warnings;
    }

    private function normaliseFuel(string $value): ?string
    {
        $value = strtoupper($this->clean($value));

        return match (true) {
            preg_match('/ELECTRIC|BATTERY|\bEV\b/', $value) === 1 => 'ELECTRIC',
            preg_match('/PETROL.*CNG|CNG.*PETROL|DUAL.*CNG/', $value) === 1 => 'PETROL+CNG',
            preg_match('/PETROL.*LPG|LPG.*PETROL|DUAL.*LPG/', $value) === 1 => 'PETROL+LPG',
            preg_match('/\bCNG\b/', $value) === 1 => 'CNG',
            preg_match('/\bDIESEL\b/', $value) === 1 => 'DIESEL',
            preg_match('/\bPETROL\b/', $value) === 1 => 'PETROL',
            preg_match('/\bLPG\b/', $value) === 1 => 'LPG',
            preg_match('/HYBRID/', $value) === 1 => 'HYBRID',
            preg_match('/HYDROGEN/', $value) === 1 => 'HYDROGEN',
            preg_match('/FLEX\s*FUEL/', $value) === 1 => 'FLEX FUEL',
            default => null,
        };
    }

    private function readImage(UploadedFile $image, string $key): string
    {
        $extension = strtolower($image->getClientOriginalExtension());
        $fileType = match ($extension) {
            'pdf' => 'PDF',
            'jpg', 'jpeg' => 'JPG',
            'png' => 'PNG',
            'webp' => 'WEBP',
            default => null,
        };

        try {
            $request = Http::timeout(45)
                ->retry(2, 300, throw: false)
                ->withHeaders(['apikey' => $key]);

            $caBundle = trim((string) config('services.ocr_space.ca_bundle'));
            if ($caBundle !== '') {
                $request = $request->withOptions(['verify' => $caBundle]);
            }

            $response = $request
                ->attach(
                    'file',
                    fopen($image->getRealPath(), 'r'),
                    $image->getClientOriginalName(),
                    ['Content-Type' => $image->getMimeType() ?: 'application/octet-stream']
                )
                ->post((string) config('services.ocr_space.url'), [
                    'language' => 'eng',
                    'filetype' => $fileType,
                    'isOverlayRequired' => 'false',
                    'detectOrientation' => 'true',
                    'scale' => 'true',
                    'OCREngine' => '2',
                ]);
        } catch (ConnectionException $exception) {
            throw new RuntimeException('OCR.Space could not be reached. Please try again.', previous: $exception);
        }

        $payload = $response->json();
        if (! $response->successful()) {
            throw new RuntimeException($this->errorMessage(
                is_array($payload) ? $payload : [],
                "OCR.Space request failed with status {$response->status()}."
            ));
        }

        if (! is_array($payload)) {
            throw new RuntimeException('OCR.Space returned an invalid response.');
        }

        if (($payload['IsErroredOnProcessing'] ?? false) === true) {
            throw new RuntimeException($this->errorMessage($payload, 'OCR.Space could not process the document.'));
        }

        $results = $payload['ParsedResults'] ?? [];
        $text = collect(is_array($results) ? $results : [])
            ->pluck('ParsedText')
            ->filter(fn ($value) => is_string($value))
            ->implode("\n");

        if (trim($text) === '') {
            throw new RuntimeException('OCR.Space did not find readable text in the image.');
        }

        return trim($text);
    }

    /** @param array<string, mixed> $payload */
    private function errorMessage(array $payload, string $fallback): string
    {
        $messages = [];
        foreach (['ErrorMessage', 'ErrorDetails'] as $key) {
            $value = $payload[$key] ?? null;
            if (is_array($value)) {
                $messages = [...$messages, ...array_map('strval', $value)];
            } elseif (is_string($value) && trim($value) !== '') {
                $messages[] = trim($value);
            }
        }

        return $messages ? implode(' ', array_unique($messages)) : $fallback;
    }

    /** @return array<string, string> */
    public function parseRc(string $text): array
    {
        $lines = array_values(array_filter(array_map(
            fn ($line) => $this->clean((string) $line),
            preg_split('/\R/u', $text) ?: []
        )));
        $joined = implode("\n", $lines);
        $fields = [];

        if (preg_match('/\b[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{3,4}\b/i', $joined, $match)) {
            $fields['vehicle_number'] = strtoupper((string) preg_replace('/[^A-Z0-9]/i', '', $match[0]));
        }

        $registrationDate = $this->labelValue(
            $lines,
            '/(?:date\s*of\s*(?:regn|reg\.?|registration)|(?:regn|reg\.?|registration)\s*date)/i'
        );
        if ($date = $this->normaliseDate($registrationDate)) {
            $fields['registration_date'] = $date;
        }

        $chassis = $this->identifier($this->labelValue($lines, '/(?:chassis|chasis)\s*(?:no|number|num)?\.?/i'));
        if (preg_match('/^[A-Z0-9]{15,25}$/', $chassis)) {
            $fields['chassis_number'] = $chassis;
        }

        $engine = $this->identifier($this->labelValue(
            $lines,
            '/(?:engine\s*\/\s*motor|engine|motor)\s*(?:no|number|num)\.?/i'
        ));
        if (preg_match('/^[A-Z0-9]{6,25}$/', $engine)) {
            $fields['engine_number'] = $engine;
        }

        $this->setTextField($fields, 'vehicle_class', $this->labelValue($lines, '/(?:vehicle\s*class|class\s*of\s*vehicle)/i'), 3, 80);
        $this->setTextField($fields, 'owner_name', $this->labelValue($lines, '/(?:owner(?:\'?s)?\s*name|name\s+of\s+owner)/i'), 2, 100);
        $this->setTextField($fields, 'manufacturer', $this->labelValue($lines, '/(?:maker\'?s?\s*(?:name)?|manufacturer|manufactured\s*by)/i'), 2, 100);
        $this->setTextField($fields, 'model', $this->labelValue($lines, '/(?:model\s*(?:name)?|maker\'?s?\s*classification)/i'), 2, 100);
        $this->setTextField($fields, 'colour', $this->labelValue($lines, '/colou?r/i'), 2, 50);
        $this->setTextField($fields, 'body_type', $this->labelValue($lines, '/body\s*type/i'), 2, 80);
        $this->setTextField($fields, 'registration_authority', $this->labelValue($lines, '/(?:registering|registration)\s+authority/i'), 2, 80);
        if (isset($fields['manufacturer'])) {
            $fields['manufacturer'] = (string) preg_replace(
                '/\bSUZUKIINDIA\b/i',
                'SUZUKI INDIA',
                $fields['manufacturer']
            );
        }
        if (isset($fields['model'])) {
            $fields['model'] = $this->normaliseModel($fields['model']);
        }
        if (isset($fields['body_type'])) {
            $fields['body_type'] = $this->collapseRepeatedAdjacentPhrase($fields['body_type']);
        }

        foreach ([
            'seating_capacity' => '/(?:seating|seat)\s*(?:capacity|cap\.?)?/i',
            'cubic_capacity' => '/(?:cubic\s*(?:capacity|cap\.?)|\bcc\b)/i',
            'number_of_cylinders' => '/(?:cylinders?\s+no\.?|no\.?\s*of\s+cylinders?|number\s+of\s+cylinders?)/i',
        ] as $field => $label) {
            $value = $this->labelValue($lines, $label, 1);
            if (($number = $this->normaliseNumericField($field, $value)) !== null) {
                $fields[$field] = $number;
            }
        }

        $manufactured = $this->labelValue(
            $lines,
            '/(?:month\s*(?:[-\/&]|and)?\s*(?:yr\.?|year)\s+of\s+mfg\.?|'
            .'mfg\.?\s+month\s*(?:[-\/&]|and)?\s*(?:yr\.?|year)|'
            .'month\s*\/\s*year\s+of\s+manufacture|manufacturing\s*(?:date|month\s*year)?)/i',
            1
        );
        if (preg_match('/\b((?:19|20)\d{2})\b/', $manufactured, $match)) {
            $fields['manufacturing_year'] = $match[1];
        } elseif (isset($fields['registration_date'])
            && preg_match('/\b((?:19|20)\d{2})\b/', $fields['registration_date'], $match)) {
            $fields['manufacturing_year'] = $match[1];
        }

        $fuelValue = $this->labelValue($lines, '/fuel(?:\s*(?:type|used))?/i', 1);
        if (($fuel = $this->normaliseFuel($fuelValue)) !== null) {
            $fields['fuel_type'] = str_contains($fuel, '+') ? $fuel : strtolower($fuel);
        }

        $classAndText = strtolower(($fields['vehicle_class'] ?? '').' '.$joined);
        if (preg_match('/m-?cycle|motor\s*cycle|scooter|2wn|two\s*wheeler/', $classAndText)) {
            $fields['vehicle_type'] = 'two_wheeler';
        } elseif (preg_match('/hgv|heavy\s*goods|truck|trailer/', $classAndText)) {
            $fields['vehicle_type'] = 'hgv';
        } elseif (preg_match('/lgv|light\s*goods|pickup/', $classAndText)) {
            $fields['vehicle_type'] = 'lgv';
        } elseif (preg_match('/taxi|cab|maxi|passenger/', $classAndText)) {
            $fields['vehicle_type'] = 'taxi';
        } elseif (preg_match('/motor\s*car|private\s*car|\blmv\b/', $classAndText)) {
            $fields['vehicle_type'] = 'private_car';
        }

        return $fields;
    }

    /** @return array<string, string> */
    public function parsePolicy(string $text): array
    {
        $lines = array_values(array_filter(array_map(fn ($line) => $this->clean((string) $line), preg_split('/\R/u', $text) ?: [])));
        $joined = implode("\n", $lines);
        $fields = [];
        $labels = [
            'company_name' => '/(?:insurance\s*company|insurer|issued\s*by)/i',
            'policy_number' => '/(?:policy|certificate)\s*(?:no|number)\.?/i',
            'insured_name' => '/(?:insured(?:\'?s)?\s*name|name\s*of\s*insured)/i',
            'long_term_tp_policy_number' => '/(?:long[\s-]*term|bundled)\s*(?:tp|third\s*party)\s*(?:policy)?\s*(?:no|number)?/i',
        ];
        foreach ($labels as $key => $label) {
            $value = $this->labelValue($lines, $label, 2);
            if (strlen($value) >= 3 && strlen($value) <= 200) {
                $fields[$key] = $value;
            }
        }
        if (preg_match('/\b[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{3,4}\b/i', $joined, $m)) {
            $fields['registration_number'] = strtoupper((string) preg_replace('/[^A-Z0-9]/i', '', $m[0]));
        }
        foreach ([
            'issue_date' => '/(?:issue|issuance)\s*date/i',
            'policy_date' => '/(?:period\s*of\s*insurance\s*from|policy\s*(?:start|from)|effective\s*from)/i',
            'expiry_date' => '/(?:policy\s*(?:expiry|end|to)|valid\s*(?:upto|until))/i',
            'long_term_tp_expiry' => '/(?:long[\s-]*term|bundled)\s*(?:tp|third\s*party).*?(?:expiry|valid)/i',
        ] as $key => $label) {
            if ($date = $this->normaliseDate($this->labelValue($lines, $label, 2))) {
                $fields[$key] = $date;
            }
        }
        foreach ([
            'od_premium' => '/(?:own\s*damage|od)\s*(?:premium|total)?/i',
            'tp_premium' => '/(?:third\s*party|tp)\s*(?:premium|liability)?/i',
            'addon_premium' => '/add[\s-]*on\s*(?:premium|cover)?/i',
            'net_premium' => '/net\s*premium/i',
            'gst_other_charges' => '/(?:gst|tax|other\s*charges)/i',
            'gross_premium' => '/(?:gross|total)\s*premium/i',
        ] as $key => $label) {
            $value = $this->labelValue($lines, $label, 1);
            if (preg_match('/(?:₹|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i', $value, $m)) {
                $fields[$key] = number_format((float) str_replace(',', '', $m[1]), 2, '.', '');
            }
        }
        $lower = strtolower($joined);
        if (str_contains($lower, 'standalone own damage')) {
            $fields['insurance_type'] = 'standalone_od';
        } elseif (str_contains($lower, 'standalone third party') || str_contains($lower, 'liability only')) {
            $fields['insurance_type'] = 'third_party';
        } elseif (str_contains($lower, 'commercial package')) {
            $fields['insurance_type'] = 'commercial_package';
        } elseif (str_contains($lower, 'comprehensive') || str_contains($lower, 'package')) {
            $fields['insurance_type'] = 'comprehensive';
        }

        return $fields;
    }

    /** @param array<int, string> $lines */
    private function labelValue(array $lines, string $label, int $lookAhead = 3): string
    {
        $blocked = '/regn|registration|chassis|chasis|engine|motor|owner|fuel|address|vehicle\s*class|maker|manufacturer|model|colou?r|body\s*type|seating|cylinders?|unladen|gross|cubic|wheel\s*base|month|mfg|manufacturing|financier|authority/i';

        foreach ($lines as $index => $line) {
            if (! preg_match($label, $line)) {
                continue;
            }

            $sameLine = $this->clean((string) preg_replace($label, '', $line, 1));
            if (strlen($sameLine) > 1) {
                return $sameLine;
            }

            for ($offset = 1; $offset <= $lookAhead; $offset++) {
                $candidate = $this->clean($lines[$index + $offset] ?? '');
                if ($candidate === '') {
                    continue;
                }
                if (preg_match($blocked, $candidate)) {
                    break;
                }
                if ($candidate !== '') {
                    return $candidate;
                }
            }
        }

        return '';
    }

    private function normaliseDate(string $value): string
    {
        if (! preg_match('/\b(\d{1,2})[\/.\-]([A-Z]{3,9}|\d{1,2})[\/.\-](\d{2,4})\b/i', $value, $match)) {
            return '';
        }

        $month = ctype_digit($match[2])
            ? (int) $match[2]
            : array_search(strtoupper(substr($match[2], 0, 3)), [
                1 => 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
            ], true);
        $year = strlen($match[3]) === 2 ? ((int) $match[3] > 50 ? '19' : '20').$match[3] : $match[3];
        if (! is_int($month) || ! checkdate($month, (int) $match[1], (int) $year)) {
            return '';
        }

        return sprintf('%04d-%02d-%02d', $year, $month, $match[1]);
    }

    private function identifier(string $value): string
    {
        return strtoupper((string) preg_replace('/[^A-Z0-9]/i', '', $value));
    }

    /** @param array<string, string> $fields */
    private function setTextField(array &$fields, string $key, string $value, int $min, int $max): void
    {
        $value = strtoupper($this->clean($value));
        if (strlen($value) >= $min && strlen($value) <= $max && preg_match('/[A-Z0-9]/', $value)) {
            $fields[$key] = $value;
        }
    }

    private function clean(string $value): string
    {
        $value = (string) preg_replace('/[|{}<>©®]/u', ' ', $value);
        $value = (string) preg_replace('/\s+/u', ' ', $value);

        return trim($value, " \t\n\r\0\x0B:;,._-\\/");
    }
}
