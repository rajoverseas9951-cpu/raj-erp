<?php
namespace App\Features\Vehicles\Models;
use App\Features\Customers\Models\Customer; use Illuminate\Database\Eloquent\Concerns\HasUuids; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo; use Illuminate\Database\Eloquent\SoftDeletes;
class Vehicle extends Model { use HasUuids,SoftDeletes; protected $fillable=['tenant_id','customer_id','registration_number','chassis_number','engine_number','manufacturer','model','variant','fuel_type','colour','manufacture_year','registration_date','status','notes','created_by','updated_by']; protected function casts(): array{return ['registration_date'=>'date','manufacture_year'=>'integer'];} public function customer(): BelongsTo{return $this->belongsTo(Customer::class);} }
