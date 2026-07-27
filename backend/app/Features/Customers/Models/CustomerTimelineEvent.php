<?php
namespace App\Features\Customers\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo;
class CustomerTimelineEvent extends Model { use HasUuids; protected $fillable=['tenant_id','customer_id','actor_id','event_type','title','description','metadata']; protected $casts=['metadata'=>'array']; public function customer(): BelongsTo { return $this->belongsTo(Customer::class); } }
