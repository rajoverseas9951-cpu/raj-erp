<?php
namespace App\Http\Middleware;
use App\Support\ErpControl\BranchContext; use App\Support\ErpControl\ErpModule; use App\Support\ErpControl\ModuleAccess; use Closure; use Illuminate\Http\Request; use Symfony\Component\HttpFoundation\Response;
class RequireErpModule { public function handle(Request $request,Closure $next,string $key):Response { $branch=app(BranchContext::class)->resolve($request->user(),$request->header('X-Branch-Code')); app(ModuleAccess::class)->authorize($request->user(),ErpModule::from($key),$branch); $request->attributes->set('erp_branch',$branch); return $next($request); } }
