<?php
namespace App\Http\Controllers\Internal;
use App\Http\Controllers\Controller; use App\Support\ErpControl\ModuleAccess; use Illuminate\Http\JsonResponse; use Illuminate\Http\Request; use Illuminate\Support\Facades\DB;
class ErpControlHealthController extends Controller {
 public function __invoke(Request $request,ModuleAccess $modules):JsonResponse { $tenant=$request->user()->tenant; $database='ok'; try{DB::select('select 1');}catch(\Throwable){$database='unavailable';} return response()->json(['service_status'=>$database==='ok'?'ok':'degraded','build'=>config('app.build_identifier',config('app.version','unknown')),'tenant_code'=>$tenant->code,'tenant_status'=>$tenant->erp_status,'enabled_modules'=>$modules->enabledKeys((string)$tenant->id),'branch_codes'=>$tenant->branches()->where('is_active',true)->orderBy('code')->pluck('code')->all(),'database'=>$database,'timestamp'=>now()->toISOString()]); }
}
