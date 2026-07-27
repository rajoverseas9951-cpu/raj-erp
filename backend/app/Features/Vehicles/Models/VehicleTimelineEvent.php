<?php
namespace App\Features\Vehicles\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo;
class VehicleTimelineEvent extends Model { use HasUuids; protected $fillable=['tenant_id','vehicle_id','actor_id','event_type','title','description','metadata']; protected $casts=['metadata'=>'array']; public function vehicle(): BelongsTo { return $this->belongsTo(Vehicle::class); } }
