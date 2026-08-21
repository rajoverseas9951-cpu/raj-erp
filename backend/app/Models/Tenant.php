<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tenant extends Model
{
    use HasUuids;

    protected $fillable = ['name', 'brand_name', 'tagline', 'address', 'city', 'state', 'pin_code', 'phone', 'email', 'gst_number', 'logo_path', 'external_tenant_id', 'code', 'slug', 'tenant_type', 'erp_status', 'erp_environment', 'erp_base_url', 'erp_tenant_url', 'control_sync_version', 'control_synced_at'];
    protected function casts(): array { return ['control_sync_version' => 'integer', 'control_synced_at' => 'datetime']; }
    public function branches(): HasMany { return $this->hasMany(Branch::class); }
    public function moduleEntitlements(): HasMany { return $this->hasMany(ErpModuleEntitlement::class); }
}
