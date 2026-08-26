<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ErpModulePreference extends Model
{
    use HasUuids;

    protected $fillable = ['tenant_id', 'module_key', 'is_enabled', 'updated_by'];

    protected function casts(): array
    {
        return ['is_enabled' => 'boolean'];
    }
}
