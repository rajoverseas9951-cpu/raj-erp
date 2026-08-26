<?php

namespace App\Http\Middleware;

use App\Support\ErpControl\ErpSubmodule;
use App\Support\ErpControl\SubmoduleAccess;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireErpSubmodule
{
    public function handle(Request $request, Closure $next, string $key): Response
    {
        $submodule = match ($key) {
            'insurance-line' => ErpSubmodule::forInsuranceLine((string) $request->route('line')),
            'vehicle-operation' => ErpSubmodule::forVehicleOperation((string) $request->route('module')),
            default => ErpSubmodule::tryFrom($key),
        };

        if ($submodule) {
            app(SubmoduleAccess::class)->authorize($request->user(), $submodule);
        }

        return $next($request);
    }
}
