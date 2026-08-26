<?php
namespace App\Support\ErpControl;
use App\Models\Branch; use App\Models\ErpModuleEntitlement; use App\Models\ErpModulePreference; use App\Models\User;
class ModuleAccess {
 public function enabled(string $tenantId,ErpModule $module,?Branch $branch=null):bool {
  $tenantQuery=ErpModuleEntitlement::query()->where('tenant_id',$tenantId);
  $platformAllowed=true;
  if($tenantQuery->exists()){
   if($branch){$override=(clone $tenantQuery)->where('branch_id',$branch->id)->where('module_key',$module->value)->value('is_enabled');if($override!==null)$platformAllowed=(bool)$override;else $platformAllowed=(bool)(clone $tenantQuery)->whereNull('branch_id')->where('module_key',$module->value)->value('is_enabled');}
   else{$platformAllowed=(bool)(clone $tenantQuery)->whereNull('branch_id')->where('module_key',$module->value)->value('is_enabled');}
  }
  if(!$platformAllowed)return false;
  $erpPreference=ErpModulePreference::query()->where('tenant_id',$tenantId)->where('module_key',$module->value)->value('is_enabled');
  return $erpPreference===null?true:(bool)$erpPreference;
 }
 public function authorize(User $user,ErpModule $module,?Branch $branch=null):void { abort_unless($this->enabled((string)$user->tenant_id,$module,$branch),403,"The {$module->value} module is disabled for this ERP."); }
 public function enabledKeys(string $tenantId):array{return collect(ErpModule::cases())->filter(fn(ErpModule $module)=>$this->enabled($tenantId,$module))->map(fn(ErpModule $module)=>$module->value)->values()->all();}
}
