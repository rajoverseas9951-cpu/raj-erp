<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class ErpModuleEntitlement extends Model { use HasUuids; protected $fillable=['tenant_id','branch_id','module_key','is_enabled']; protected function casts():array{return ['is_enabled'=>'boolean'];} }
