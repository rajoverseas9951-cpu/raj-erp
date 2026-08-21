<?php
namespace App\Http\Middleware;
use Closure; use Illuminate\Http\Request; use Symfony\Component\HttpFoundation\Response;
class EnsureErpTenantIsActive { public function handle(Request $request,Closure $next):Response { if($request->user()?->tenant?->erp_status!=='ACTIVE')return response()->json(['success'=>false,'error'=>['code'=>'ERP_SUSPENDED','message'=>'ERP access is suspended for this tenant.']],423); return $next($request); } }
