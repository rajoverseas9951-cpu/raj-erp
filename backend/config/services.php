<?php

return [
    'ocr_space' => [
        'key' => env('OCR_SPACE_API_KEY'),
        'url' => env('OCR_SPACE_API_URL', 'https://api.ocr.space/parse/image'),
        'ca_bundle' => env('OCR_SPACE_CA_BUNDLE'),
    ],
];
