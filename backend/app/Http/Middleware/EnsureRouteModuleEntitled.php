<?php

namespace App\Http\Middleware;

use App\Support\ErpControl\BranchContext;
use App\Support\ErpControl\ErpModule;
use App\Support\ErpControl\ModuleAccess;
use Closure;
use Illuminate\Http\Request;
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

        foreach (array_unique($required, SORT_REGULAR) as $module) {
            $access->authorize($request->user(), $module, $branch);
        }

        if ($required !== []) {
            $request->attributes->set('erp_branch', $branch);
        }

        return $next($request);
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

        return [];
    }
}
