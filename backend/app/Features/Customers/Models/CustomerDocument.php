<?php
namespace App\Features\Customers\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo; use Illuminate\Database\Eloquent\SoftDeletes;
class CustomerDocument extends Model { use HasUuids, SoftDeletes; protected $fillable=['tenant_id','customer_id','document_type','file_id','file_name','mime_type','size_bytes','uploaded_by']; public function customer(): BelongsTo { return $this->belongsTo(Customer::class); } }
