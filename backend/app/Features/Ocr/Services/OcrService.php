<?php

namespace App\Features\Ocr\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OcrService
{
    /**
     * @param  array<int, UploadedFile>  $images
     * @return array{text:string,texts:array<int,string>,fields:array<string,string>}
     */
    public function scan(array $images, string $documentType): array
    {
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
            'fields' => $documentType === 'rc' ? $this->parseRc($text) : [],
        ];
    }

    private function readImage(UploadedFile $image, string $key): string
    {
        try {
            $response = Http::timeout(45)
                ->retry(2, 300, throw: false)
                ->withHeaders(['apikey' => $key])
                ->attach('file', fopen($image->getRealPath(), 'r'), $image->getClientOriginalName())
                ->post((string) config('services.ocr_space.url'), [
                    'language' => 'eng',
                    'isOverlayRequired' => 'false',
                    'detectOrientation' => 'true',
                    'scale' => 'true',
                    'OCREngine' => '2',
                ]);
        } catch (ConnectionException $exception) {
            throw new RuntimeException('OCR.Space could not be reached. Please try again.', previous: $exception);
        }

        if (! $response->successful()) {
            throw new RuntimeException("OCR.Space request failed with status {$response->status()}.");
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            throw new RuntimeException('OCR.Space returned an invalid response.');
        }

        if (($payload['IsErroredOnProcessing'] ?? false) === true) {
            $message = $payload['ErrorMessage'] ?? $payload['ErrorDetails'] ?? 'OCR.Space could not process the image.';
            if (is_array($message)) {
                $message = implode(' ', $message);
            }
            throw new RuntimeException((string) $message);
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
