<?php
namespace App\Support\ErpControl;
use App\Models\Branch; use App\Models\ErpModuleEntitlement; use App\Models\User;
class ModuleAccess {
 public function enabled(string $tenantId,ErpModule $module,?Branch $branch=null):bool { $tenantQuery=ErpModuleEntitlement::query()->where('tenant_id',$tenantId); if(!$tenantQuery->exists())return true; if($branch){$override=(clone $tenantQuery)->where('branch_id',$branch->id)->where('module_key',$module->value)->value('is_enabled');if($override!==null)return(bool)$override;} return (bool)(clone $tenantQuery)->whereNull('branch_id')->where('module_key',$module->value)->value('is_enabled'); }
 public function authorize(User $user,ErpModule $module,?Branch $branch=null):void { abort_unless($this->enabled((string)$user->tenant_id,$module,$branch),403,"The {$module->value} module is disabled for this tenant or branch."); }
 public function enabledKeys(string $tenantId):array{return ErpModuleEntitlement::query()->where('tenant_id',$tenantId)->whereNull('branch_id')->where('is_enabled',true)->orderBy('module_key')->pluck('module_key')->all();}
}
