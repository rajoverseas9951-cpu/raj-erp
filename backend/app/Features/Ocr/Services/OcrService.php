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
                if (is_resource($stream)) fclose($stream);
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
            if (! is_array($line) || ! is_string($line['text'] ?? null)) continue;
            $source = is_string($line['source'] ?? null) ? $line['source'] : 'combined';
            $textsBySource[$source][] = trim($line['text']);
        }
        $texts = array_values(array_map(
            fn (array $lines) => trim(implode("\n", array_filter($lines))),
            $textsBySource
        ));
        if ($texts === [] && $text !== '') $texts = [$text];

        $mappedFields = $this->mapPaddleRcFields($payload['fields']);
        $mappedConfidence = $this->mapPaddleRcConfidence(
            is_array($payload['field_confidence'] ?? null) ? $payload['field_confidence'] : []
        );
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
            'warnings' => array_values(array_filter(
                is_array($payload['warnings'] ?? null) ? $payload['warnings'] : [],
                fn ($warning) => is_string($warning) && trim($warning) !== ''
            )),
        ];
    }

    /** @param array<string, mixed> $source @return array<string, string> */
    private function mapPaddleRcFields(array $source): array
    {
        $fields = [];
        foreach ([
            'vehicle_number', 'registration_authority', 'chassis_number', 'engine_number',
            'owner_name', 'father_or_spouse_name', 'ownership_type', 'address',
            'manufacturer', 'model', 'variant', 'vehicle_class', 'body_type', 'colour',
            'emission_norms', 'financier',
        ] as $key) {
            $value = $source[$key] ?? null;
            if (is_string($value) && trim($value) !== '') $fields[$key] = trim($value);
        }

        if (isset($fields['vehicle_number'])) $fields['vehicle_number'] = $this->identifier($fields['vehicle_number']);
        foreach (['chassis_number', 'engine_number'] as $key) {
            if (isset($fields[$key])) $fields[$key] = $this->identifier($fields[$key]);
        }
        foreach ([
            'owner_name', 'father_or_spouse_name', 'ownership_type', 'manufacturer',
            'model', 'variant', 'vehicle_class', 'body_type', 'colour',
            'registration_authority', 'emission_norms', 'financier',
        ] as $key) {
            if (isset($fields[$key])) $fields[$key] = strtoupper($this->clean($fields[$key]));
        }
        if (isset($fields['manufacturer'])) {
            $fields['manufacturer'] = $this->normaliseManufacturer($fields['manufacturer']);
        }
        if (isset($fields['body_type'])) {
            $fields['vehicle_category'] = $fields['body_type'];
            unset($fields['body_type']);
        }
        if (isset($fields['registration_authority'])) {
            $fields['district'] = $fields['registration_authority'];
        }
        if (str_starts_with($fields['vehicle_number'] ?? '', 'GJ')) $fields['state'] = 'Gujarat';

        $registrationDate = $source['registration_date'] ?? null;
        if (is_string($registrationDate) && ($date = $this->normaliseDate($registrationDate))) {
            $fields['registration_date'] = $date;
        }
        $registrationValidity = $source['registration_valid_upto'] ?? null;
        if (is_string($registrationValidity) && ($date = $this->normaliseDate($registrationValidity))) {
            $fields['registration_valid_upto'] = $date;
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
            'horse_power' => 'horse_power',
            'wheel_base' => 'wheel_base',
            'number_of_cylinders' => 'number_of_cylinders',
        ] as $sourceKey => $targetKey) {
            $value = $source[$sourceKey] ?? null;
            if (is_string($value) && preg_match('/\d+(?:\.\d+)?/', $value, $match)) {
                $fields[$targetKey] = $match[0];
            }
        }

        $manufacturingMonth = $source['manufacturing_month'] ?? null;
        if (is_string($manufacturingMonth) && preg_match('/\b(0?[1-9]|1[0-2])\b/', $manufacturingMonth, $match)) {
            $fields['manufacturing_month'] = str_pad($match[1], 2, '0', STR_PAD_LEFT);
        }
        $manufacturingYear = $source['manufacturing_year'] ?? null;
        if (is_string($manufacturingYear) && preg_match('/\b(?:19|20)\d{2}\b/', $manufacturingYear, $match)) {
            $fields['manufacturing_year'] = $match[0];
        } else {
            $manufactured = $source['manufacturing_month_year'] ?? null;
            if (is_string($manufactured) && preg_match('/\b(?:19|20)\d{2}\b/', $manufactured, $match)) {
                $fields['manufacturing_year'] = $match[0];
            }
            if (is_string($manufactured) && preg_match('/\b(0?[1-9]|1[0-2])[.\/-](?:19|20)\d{2}\b/', $manufactured, $match)) {
                $fields['manufacturing_month'] = str_pad($match[1], 2, '0', STR_PAD_LEFT);
            }
            if (is_string($manufactured) && ! isset($fields['manufacturing_month'])) {
                $month = $this->normaliseMonthName($manufactured);
                if ($month !== null) {
                    $fields['manufacturing_month'] = $month;
                }
            }
        }

        if (isset($fields['model']) && ! isset($fields['variant'])
            && preg_match('/^(.+?)\s*\(([^()]{1,30})\)$/', $fields['model'], $match)) {
            $fields['model'] = trim($match[1]);
            $fields['variant'] = trim($match[2]);
        }

        $class = strtolower($fields['vehicle_class'] ?? '');
        if (preg_match('/m-?cycle|motor\s*cycle|scooter|2wn|two\s*wheeler/', $class)) $fields['vehicle_type'] = 'two_wheeler';
        elseif (preg_match('/hgv|heavy\s*goods|truck|trailer/', $class)) $fields['vehicle_type'] = 'hgv';
        elseif (preg_match('/lgv|light\s*goods|pickup/', $class)) $fields['vehicle_type'] = 'lgv';
        elseif (preg_match('/taxi|cab|maxi|passenger/', $class)) $fields['vehicle_type'] = 'taxi';
        elseif (preg_match('/motor\s*car|private\s*car|\blmv\b/', $class)) $fields['vehicle_type'] = 'private_car';

        return array_filter($fields, fn ($value) => $value !== '');
    }

    /** @param array<string, mixed> $source @return array<string, float> */
    private function mapPaddleRcConfidence(array $source): array
    {
        $mapping = [
            'body_type' => ['vehicle_category'],
            'manufacturing_month_year' => ['manufacturing_month', 'manufacturing_year'],
            'gross_vehicle_weight' => ['gross_weight'],
        ];
        $confidence = [];
        foreach ($source as $field => $value) {
            if (! is_string($field) || ! is_numeric($value)) continue;
            foreach ($mapping[$field] ?? [$field] as $target) {
                $confidence[$target] = max(0.0, min(1.0, (float) $value));
            }
        }
        return $confidence;
    }

    private function normaliseFuel(string $value): ?string
    {
        $value = strtoupper($this->clean($value));
        return match (true) {
            preg_match('/ELECTRIC|BATTERY|\bEV\b/', $value) === 1 => 'ELECTRIC',
            preg_match('/PETROL.*CNG|CNG.*PETROL|DUAL.*CNG/', $value) === 1 => 'PETROL/CNG',
            preg_match('/PETROL.*LPG|LPG.*PETROL|DUAL.*LPG/', $value) === 1 => 'PETROL/LPG',
            preg_match('/\bCNG\b/', $value) === 1 => 'CNG',
            preg_match('/\bDIESEL\b/', $value) === 1 => 'DIESEL',
            preg_match('/\bPETROL\b/', $value) === 1 => 'PETROL',
            preg_match('/\bLPG\b/', $value) === 1 => 'LPG',
            preg_match('/HYBRID/', $value) === 1 => 'HYBRID',
            default => null,
        };
    }

    private function normaliseManufacturer(string $value): string
    {
        return (string) preg_replace(
            '/(?<!\s)(PVT\.?\s*LTD\.?|LTD\.?|LIMITED)$/i',
            ' $1',
            strtoupper($this->clean($value))
        );
    }

    private function normaliseMonthName(string $value): ?string
    {
        $months = [
            'JAN' => '01', 'FEB' => '02', 'MAR' => '03', 'APR' => '04',
            'MAY' => '05', 'JUN' => '06', 'JUL' => '07', 'AUG' => '08',
            'SEP' => '09', 'OCT' => '10', 'NOV' => '11', 'DEC' => '12',
        ];
        if (! preg_match(
            '/\b(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|'
            .'JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:TEMBER)?|OCT(?:OBER)?|'
            .'NOV(?:EMBER)?|DEC(?:EMBER)?)\b/i',
            $value,
            $match
        )) {
            return null;
        }

        return $months[strtoupper(substr($match[1], 0, 3))] ?? null;
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
            if (is_array($value)) $messages = [...$messages, ...array_map('strval', $value)];
            elseif (is_string($value) && trim($value) !== '') $messages[] = trim($value);
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

        $registrationDate = $this->labelValue($lines, '/(?:date\s*of\s*(?:regn|registration)|regn\.?\s*date|registration\s*date)/i');
        if ($date = $this->normaliseDate($registrationDate)) {
            $fields['registration_date'] = $date;
        }

        $chassis = $this->identifier($this->labelValue($lines, '/(?:chassis|chasis)\s*(?:no|number|num)?\.?/i'));
        if (preg_match('/^[A-Z0-9]{15,25}$/', $chassis)) {
            $fields['chassis_number'] = $chassis;
        }

        $engine = $this->identifier($this->labelValue($lines, '/(?:engine\s*\/\s*motor|engine|motor)\s*(?:no|number|num)?\.?/i'));
        if (preg_match('/^[A-Z0-9]{6,25}$/', $engine)) {
            $fields['engine_number'] = $engine;
        }

        $this->setTextField($fields, 'vehicle_class', $this->labelValue($lines, '/(?:vehicle\s*class|class\s*of\s*vehicle)/i'), 3, 80);
        $this->setTextField($fields, 'manufacturer', $this->labelValue($lines, '/(?:maker\'?s?\s*(?:name)?|manufacturer|manufactured\s*by)/i'), 2, 100);
        $this->setTextField($fields, 'model', $this->labelValue($lines, '/(?:model\s*(?:name)?|maker\'?s?\s*classification)/i'), 2, 100);
        $this->setTextField($fields, 'colour', $this->labelValue($lines, '/colou?r/i'), 2, 50);

        if (preg_match('/\b(PETROL|DIESEL|CNG|LPG|ELECTRIC|BATTERY|EV|HYBRID)\b/i', $joined, $match)) {
            $fuel = strtolower($match[1]);
            $fields['fuel_type'] = preg_match('/electric|battery|ev/i', $fuel) ? 'electric' : $fuel;
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
            if (strlen($value) >= 3 && strlen($value) <= 200) $fields[$key] = $value;
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
            if ($date = $this->normaliseDate($this->labelValue($lines, $label, 2))) $fields[$key] = $date;
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
        if (str_contains($lower, 'standalone own damage')) $fields['insurance_type'] = 'standalone_od';
        elseif (str_contains($lower, 'standalone third party') || str_contains($lower, 'liability only')) $fields['insurance_type'] = 'third_party';
        elseif (str_contains($lower, 'commercial package')) $fields['insurance_type'] = 'commercial_package';
        elseif (str_contains($lower, 'comprehensive') || str_contains($lower, 'package')) $fields['insurance_type'] = 'comprehensive';
        return $fields;
    }

    /** @param array<int, string> $lines */
    private function labelValue(array $lines, string $label, int $lookAhead = 3): string
    {
        $blocked = '/regn|registration|chassis|chasis|engine|motor|owner|fuel|address|vehicle\s*class|maker|manufacturer|model|colou?r|body\s*type|seating|unladen|cubic|financier|authority/i';

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
                if ($candidate !== '' && ! preg_match($blocked, $candidate)) {
                    return $candidate;
                }
            }
        }

        return '';
    }

    private function normaliseDate(string $value): string
    {
        if (! preg_match('/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/', $value, $match)) {
            return '';
        }

        $year = strlen($match[3]) === 2 ? ((int) $match[3] > 50 ? '19' : '20').$match[3] : $match[3];
        if (! checkdate((int) $match[2], (int) $match[1], (int) $year)) {
            return '';
        }

        return sprintf('%04d-%02d-%02d', $year, $match[2], $match[1]);
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
