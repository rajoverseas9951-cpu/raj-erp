<?php
namespace App\Features\Vehicles\Models;
use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo;
class VehicleInsurance extends Model { public function vehicle(): BelongsTo { return $this->belongsTo(Vehicle::class); } }
