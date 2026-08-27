<?php

namespace App\Http\Middleware;

use App\Support\ErpControl\BranchContext;
use App\Support\ErpControl\ErpModule;
use App\Support\ErpControl\ErpSubmodule;
use App\Support\ErpControl\ModuleAccess;
use App\Support\ErpControl\SubmoduleAccess;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class EnsureRouteModuleEntitled
{
    private const PREFIXES = [
        'customers' => ErpModule::CUSTOMERS,
        'vehicles' => ErpModule::VEHICLES,
        'vehicle-masters' => ErpModule::VEHICLES,
        'vehicle-operation-masters' => ErpModule::VEHICLES,
        'policies' => ErpModule::POLICIES,
        'other-insurance' => ErpModule::POLICIES,
        'renewals' => ErpModule::RENEWALS,
        'claims' => ErpModule::CLAIMS,
        'claim-policies' => ErpModule::CLAIMS,
        'reports' => ErpModule::REPORTS,
        'fleets' => ErpModule::FLEET,
        'accounting' => ErpModule::ACCOUNTING,
        'ledgers' => ErpModule::ACCOUNTING,
        'insurance-accounting' => ErpModule::ACCOUNTING,
        'insurance-operations' => ErpModule::ACCOUNTING,
        'payments' => ErpModule::PAYMENTS,
        'ocr' => ErpModule::RC_API,
        'service-works' => ErpModule::RTO,
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $branch = app(BranchContext::class)->resolve($request->user(), $request->header('X-Branch-Code'));
        $access = app(ModuleAccess::class);
        $required = [];

        $segment = $request->segment(3);
        if (isset(self::PREFIXES[$segment])) {
            $required[] = self::PREFIXES[$segment];
        }

        foreach ($this->dependentModules($request) as $module) {
            $required[] = $module;
        }

        $unique = [];
        foreach ($required as $module) {
            $unique[$module->value] = $module;
        }

        foreach ($unique as $module) {
            $access->authorize($request->user(), $module, $branch);
        }

        $this->authorizeSubmodule($request);

        if ($unique !== []) {
            $request->attributes->set('erp_branch', $branch);
        }

        $response = $next($request);

        if ($response instanceof JsonResponse && $request->is('api/v1/vehicles/*/operational-profile')) {
            $this->filterOperationalProfile($request, $response);
        }

        return $response;
    }

    /** @return array<ErpModule> */
    private function dependentModules(Request $request): array
    {
        if ($request->is('api/v1/reports/insurance-due*') || $request->is('api/v1/reports/insurance-commission*')) {
            return [ErpModule::POLICIES, ErpModule::ACCOUNTING];
        }

        if ($request->is('api/v1/reports/expiry*') || $request->is('api/v1/reports/insurance*')) {
            return [ErpModule::POLICIES];
        }

        if ($request->is('api/v1/reports/rto-profit*')) {
            return [ErpModule::RTO, ErpModule::ACCOUNTING];
        }

        if ($request->is('api/v1/reports/rto-work*') || $request->is('api/v1/reports/hsrp*')) {
            return [ErpModule::RTO];
        }

        if ($request->is('api/v1/vehicles/*/insurance-calculation*') || $request->is('api/v1/vehicles/*/insurances*')) {
            return [ErpModule::POLICIES];
        }

        if ($request->is('api/v1/vehicles/*/rto-work-accounting*') || $request->is('api/v1/vehicles/*/operations/payment*')) {
            return [ErpModule::ACCOUNTING];
        }

        return [];
    }

    private function authorizeSubmodule(Request $request): void
    {
        $submodule = null;

        if ($request->is('api/v1/accounting/simple-entry*')) {
            $submodule = ErpSubmodule::ACCOUNTS_CASH_BANK;
        } elseif ($request->is('api/v1/accounting/outstanding*') || $request->is('api/v1/vehicles/*/operations/payment*')) {
            $submodule = ErpSubmodule::ACCOUNTS_RECEIVABLES;
        } elseif ($request->is('api/v1/insurance-operations/company-payments*') || $request->is('api/v1/vehicles/*/insurances/*/settlement*')) {
            $submodule = ErpSubmodule::ACCOUNTS_INSURANCE_PAYMENTS;
        } elseif ($request->is('api/v1/insurance-accounting/commissions*') || $request->is('api/v1/reports/insurance-commission*')) {
            $submodule = ErpSubmodule::ACCOUNTS_INSURANCE_COMMISSION;
        } elseif ($request->is('api/v1/vehicles/*/rto-work-accounting*') || $request->is('api/v1/reports/rto-profit*')) {
            $submodule = ErpSubmodule::ACCOUNTS_RTO_FINANCE;
        } elseif ($request->is('api/v1/ledgers*') || $request->is('api/v1/accounting/opening-balances*') || $request->is('api/v1/accounting/financial-year*')) {
            $submodule = ErpSubmodule::ACCOUNTS_LEDGERS_YEAR;
        } elseif ($request->is('api/v1/policies*') || $request->is('api/v1/vehicles/*/insurance-calculation*') || $request->is('api/v1/vehicles/*/insurances*')) {
            $submodule = ErpSubmodule::INSURANCE_MOTOR;
        } elseif ($request->is('api/v1/other-insurance/*')) {
            $submodule = ErpSubmodule::forInsuranceLine((string) $request->route('line'));
        } elseif ($request->is('api/v1/vehicles/*/operations/*')) {
            $submodule = ErpSubmodule::forVehicleOperation((string) $request->route('module'));
        } elseif ($request->is('api/v1/reports/hsrp*')) {
            $submodule = ErpSubmodule::RTO_HSRP;
        } elseif ($request->is('api/v1/vehicle-operation-masters/*') && (string) $request->route('type') === 'permit_type') {
            $submodule = ErpSubmodule::RTO_PERMIT;
        }

        if (! $submodule && $request->is('api/v1/vehicles/*/operation-documents/*')) {
            $documentId = (string) $request->route('document');
            $module = DB::table('vehicle_operation_documents')
                ->where('tenant_id', (string) $request->user()?->tenant_id)
                ->where('id', $documentId)
                ->whereNull('deleted_at')
                ->value('module');
            $submodule = $module ? ErpSubmodule::forVehicleOperation((string) $module) : null;
        }

        if ($submodule) {
            app(SubmoduleAccess::class)->authorize($request->user(), $submodule);
        }
    }

    private function filterOperationalProfile(Request $request, JsonResponse $response): void
    {
        $payload = $response->getData(true);
        if (! is_array($payload) || ! isset($payload['data']) || ! is_array($payload['data'])) {
            return;
        }

        $tenantId = (string) $request->user()?->tenant_id;
        $access = app(SubmoduleAccess::class);
        $enabled = fn (ErpSubmodule $submodule): bool => $access->enabled($tenantId, $submodule);

        $moduleMap = [
            'puc' => ErpSubmodule::RTO_PUC,
            'fitness' => ErpSubmodule::RTO_FITNESS,
            'permit' => ErpSubmodule::RTO_PERMIT,
            'tax' => ErpSubmodule::RTO_TAX,
            'counter_tax' => ErpSubmodule::RTO_TAX,
            'hsrp' => ErpSubmodule::RTO_HSRP,
            'insurance' => ErpSubmodule::INSURANCE_MOTOR,
            'payment' => ErpSubmodule::ACCOUNTS_RECEIVABLES,
        ];

        if (isset($payload['data']['modules']) && is_array($payload['data']['modules'])) {
            foreach ($moduleMap as $key => $submodule) {
                if (! $enabled($submodule)) {
                    unset($payload['data']['modules'][$key]);
                }
            }
        }

        if (isset($payload['data']['applicability']['groups']) && is_array($payload['data']['applicability']['groups'])) {
            foreach ($payload['data']['applicability']['groups'] as $group => $modules) {
                if (! is_array($modules)) continue;
                $payload['data']['applicability']['groups'][$group] = array_values(array_filter(
                    $modules,
                    function ($module) use ($moduleMap, $enabled) {
                        $submodule = $moduleMap[(string) $module] ?? null;
                        return ! $submodule || $enabled($submodule);
                    }
                ));
            }
        }

        $response->setData($payload);
    }
}
