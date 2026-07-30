<?php
use App\Features\Accounting\Controllers\AccountingController;
use App\Features\Accounting\Controllers\InsuranceAccountingController;
use App\Features\Accounting\Controllers\LedgerController;
use App\Features\Customers\Controllers\CustomerController;
use App\Features\Vehicles\Controllers\VehicleController;
use App\Features\Identity\Controllers\AuthController;
use App\Features\Identity\Controllers\RoleController;
use App\Features\Identity\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::get('health', fn () => response()->json(['status' => 'ok']));

Route::prefix('v1/auth')->group(function () {
 Route::post('login',[AuthController::class,'login'])->middleware('throttle:login');
 Route::post('forgot-password',[AuthController::class,'forgot'])->middleware('throttle:passwords');
 Route::post('reset-password',[AuthController::class,'reset'])->middleware('throttle:passwords');
});

Route::prefix('v1')->middleware(['auth:sanctum','active'])->group(function () {
 Route::post('auth/logout',[AuthController::class,'logout']);
 Route::post('auth/refresh',[AuthController::class,'refresh'])->middleware('throttle:60,1');
 Route::put('auth/password',[AuthController::class,'change'])->middleware('throttle:passwords');
 Route::get('roles',[RoleController::class,'index']);
 Route::apiResource('users',UserController::class);

 Route::get('ledgers',[LedgerController::class,'index']);
 Route::post('ledgers',[LedgerController::class,'store']);
 Route::get('accounting/vouchers',[AccountingController::class,'vouchers']);
 Route::post('accounting/vouchers',[AccountingController::class,'storeVoucher']);
 Route::get('accounting/day-book',[AccountingController::class,'dayBook']);
 Route::get('accounting/ledger-statement/{ledgerId}',[AccountingController::class,'ledgerStatement']);
 Route::get('accounting/trial-balance',[AccountingController::class,'trialBalance']);
 Route::get('accounting/profit-loss',[AccountingController::class,'profitLoss']);
 Route::get('accounting/balance-sheet',[AccountingController::class,'balanceSheet']);

 Route::get('insurance-accounting/companies',[InsuranceAccountingController::class,'companies']);
 Route::post('insurance-accounting/companies',[InsuranceAccountingController::class,'storeCompany']);
 Route::get('insurance-accounting/commissions',[InsuranceAccountingController::class,'commissions']);
 Route::post('insurance-accounting/commissions',[InsuranceAccountingController::class,'storeCommission']);
 Route::post('insurance-accounting/commissions/{id}/receive',[InsuranceAccountingController::class,'receiveCommission']);
 Route::get('insurance-accounting/summary',[InsuranceAccountingController::class,'summary']);

 Route::get('vehicles/export',[VehicleController::class,'export']);
 Route::post('vehicles/bulk-delete',[VehicleController::class,'bulkDelete']);
 Route::post('vehicles/bulk-update',[VehicleController::class,'bulkUpdate']);
 Route::get('vehicles/{vehicle}/timeline',[VehicleController::class,'timeline']);
 Route::apiResource('vehicles',VehicleController::class);

 Route::get('customers/export',[CustomerController::class,'export']);
 Route::post('customers/bulk-delete',[CustomerController::class,'bulkDelete']);
 Route::post('customers/bulk-assign',[CustomerController::class,'bulkAssign']);
 Route::get('customers/{customer}/timeline',[CustomerController::class,'timeline']);
 Route::apiResource('customers',CustomerController::class);
});
