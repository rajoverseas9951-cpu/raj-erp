<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Tenant extends Model
{
    use HasUuids;

    protected $fillable = ['name', 'brand_name', 'tagline', 'address', 'city', 'state', 'pin_code', 'phone', 'email', 'gst_number', 'logo_path'];
}
