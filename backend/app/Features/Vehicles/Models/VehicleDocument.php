<?php
namespace App\Features\Vehicles\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo; use Illuminate\Database\Eloquent\SoftDeletes;
class VehicleDocument extends Model { use HasUuids, SoftDeletes; protected $fillable=['tenant_id','vehicle_id','document_type','file_id','file_name','mime_type','size_bytes','uploaded_by']; public function vehicle(): BelongsTo { return $this->belongsTo(Vehicle::class); } }
