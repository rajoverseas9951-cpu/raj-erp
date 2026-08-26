<?php

use App\Features\Accounting\Controllers\ClaimPolicyLookupController;
use App\Features\Accounting\Controllers\OtherInsurancePaymentController;
use Illuminate\Support\Facades\Route;

Route::prefix('api/v1')->middleware(['auth:sanctum', 'active', 'erp.active', 'erp.entitlements'])->group(function () {
    Route::get('insurance-operations/company-payments/other', [OtherInsurancePaymentController::class, 'index']);
    Route::get('insurance-operations/company-payments/other/{policy}', [OtherInsurancePaymentController::class, 'history']);
    Route::post('insurance-operations/company-payments/other/{policy}', [OtherInsurancePaymentController::class, 'store']);

    // Keep policy lookup outside /claims/{id} to avoid any dynamic-route ambiguity.
    Route::get('claim-policies', [ClaimPolicyLookupController::class, 'index']);
});
