<?php

use App\Features\Ocr\Controllers\PublicPolicyOcrController;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['name' => config('app.name'), 'status' => 'ok']));

Route::post('/public-policy-ocr', PublicPolicyOcrController::class)
    ->middleware('throttle:8,1')
    ->withoutMiddleware([ValidateCsrfToken::class]);
