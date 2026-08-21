<?php
namespace App\Http\Middleware;
use App\Support\ErpControl\BranchContext; use App\Support\ErpControl\ErpModule; use App\Support\ErpControl\ModuleAccess; use Closure; use Illuminate\Http\Request; use Symfony\Component\HttpFoundation\Response;
class EnsureRouteModuleEntitled {
 private const PREFIXES=['customers'=>ErpModule::CUSTOMERS,'vehicles'=>ErpModule::VEHICLES,'vehicle-masters'=>ErpModule::VEHICLES,'policies'=>ErpModule::POLICIES,'reports'=>ErpModule::REPORTS,'fleets'=>ErpModule::FLEET,'accounting'=>ErpModule::ACCOUNTING,'ledgers'=>ErpModule::ACCOUNTING,'insurance-accounting'=>ErpModule::ACCOUNTING,'ocr'=>ErpModule::RC_API];
 public function handle(Request $request,Closure $next):Response { $segment=$request->segment(3); $module=self::PREFIXES[$segment]??null; if($module){$branch=app(BranchContext::class)->resolve($request->user(),$request->header('X-Branch-Code')); app(ModuleAccess::class)->authorize($request->user(),$module,$branch);$request->attributes->set('erp_branch',$branch);} return $next($request); }
}
