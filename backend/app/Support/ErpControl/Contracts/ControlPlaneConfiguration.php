<?php
namespace App\Support\ErpControl\Contracts;
use App\Support\ErpControl\ErpModule;
final readonly class ControlPlaneConfiguration {
 public function __construct(public string $externalTenantId,public string $tenantCode,public string $tenantType,public string $status,public string $environment,public string $baseUrl,public string $tenantUrl,public array $enabledModules,public array $branches,public int $syncVersion,public string $syncedAt){}
 public static function fromArray(array $data):self{return new self($data['external_tenant_id'],$data['tenant_code'],$data['tenant_type'],$data['status'],$data['environment'],$data['base_url'],$data['tenant_url'],array_map(fn(string $key)=>ErpModule::from($key)->value,$data['enabled_modules']),$data['branches'],(int)$data['sync_version'],$data['synced_at']);}
 public static function rules():array{return ['external_tenant_id'=>['required','string','max:120'],'tenant_code'=>['required','string','max:80'],'tenant_type'=>['required','in:VIMAWALLAH_INTERNAL,SAAS_CUSTOMER'],'status'=>['required','in:ACTIVE,SUSPENDED'],'environment'=>['required','in:DEVELOPMENT,STAGING,PRODUCTION'],'base_url'=>['required','url'],'tenant_url'=>['required','url'],'enabled_modules'=>['required','array'],'enabled_modules.*'=>['required','string'],'branches'=>['required','array'],'branches.*.code'=>['required','string','max:80'],'branches.*.enabled_modules'=>['sometimes','array'],'sync_version'=>['required','integer','min:0'],'synced_at'=>['required','date']];}
}
