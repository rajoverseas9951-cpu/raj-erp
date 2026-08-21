<?php
return [
    'name' => env('APP_NAME', 'Raj ERP'), 'env' => env('APP_ENV', 'production'), 'debug' => (bool) env('APP_DEBUG', false),
    'url' => env('APP_URL', 'https://example.invalid'), 'frontend_url' => env('FRONTEND_URL', 'https://example.invalid'), 'version' => env('ERP_VERSION', 'development'), 'build_identifier' => env('ERP_BUILD_IDENTIFIER'), 'timezone' => env('APP_TIMEZONE', 'Asia/Kolkata'), 'locale' => env('APP_LOCALE', 'en'),
    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'en'), 'faker_locale' => env('APP_FAKER_LOCALE', 'en_US'),
    'cipher' => 'AES-256-CBC', 'key' => env('APP_KEY'), 'previous_keys' => array_filter(explode(',', (string) env('APP_PREVIOUS_KEYS', ''))),
    'maintenance' => ['driver' => env('APP_MAINTENANCE_DRIVER', 'file'), 'store' => env('APP_MAINTENANCE_STORE', 'database')],
];
