<?php
use App\Features\Customers\Controllers\CustomerController; use Illuminate\Support\Facades\Route;
Route::prefix('v1')->middleware(['auth:sanctum'])->group(function(){ Route::get('customers/export',[CustomerController::class,'export']); Route::post('customers/bulk-delete',[CustomerController::class,'bulkDelete']); Route::post('customers/bulk-assign',[CustomerController::class,'bulkAssign']); Route::get('customers/{customer}/timeline',[CustomerController::class,'timeline']); Route::apiResource('customers',CustomerController::class); });
