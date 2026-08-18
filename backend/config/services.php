<?php

return [
    'ocr_space' => [
        'key' => env('OCR_SPACE_API_KEY'),
        'url' => env('OCR_SPACE_API_URL', 'https://api.ocr.space/parse/image'),
        'ca_bundle' => env('OCR_SPACE_CA_BUNDLE'),
    ],
    'paddleocr' => [
        'url' => env('PADDLEOCR_URL', 'http://127.0.0.1:8081'),
        'timeout' => (int) env('PADDLEOCR_TIMEOUT', 100),
        'public_token' => env('PADDLEOCR_PUBLIC_TOKEN'),
    ],
    'openai' => [
        'key' => env('OPENAI_API_KEY'),
        'bug_agent_model' => env('BUG_AGENT_MODEL', 'gpt-5.6-terra'),
    ],
];
