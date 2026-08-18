<?php

use App\Features\Ocr\Controllers\OcrController;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['name' => config('app.name'), 'status' => 'ok']));

Route::post('/public-policy-ocr', [OcrController::class, 'publicPolicyScan'])
    ->middleware('throttle:12,1')
    ->withoutMiddleware([ValidateCsrfToken::class]);
