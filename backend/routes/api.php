<?php

use App\Features\Customers\Controllers\CustomerController;
use App\Features\Vehicles\Controllers\VehicleController;
use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('health', fn () => response()->json(['status' => 'ok']));
Route::post('v1/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('vehicles/export', [VehicleController::class, 'export']);
    Route::post('vehicles/bulk-delete', [VehicleController::class, 'bulkDelete']);
    Route::post('vehicles/bulk-update', [VehicleController::class, 'bulkUpdate']);
    Route::get('vehicles/{vehicle}/timeline', [VehicleController::class, 'timeline']);
    Route::apiResource('vehicles', VehicleController::class);
    Route::get('customers/export', [CustomerController::class, 'export']);
    Route::post('customers/bulk-delete', [CustomerController::class, 'bulkDelete']);
    Route::post('customers/bulk-assign', [CustomerController::class, 'bulkAssign']);
    Route::get('customers/{customer}/timeline', [CustomerController::class, 'timeline']);
    Route::apiResource('customers', CustomerController::class);
});
