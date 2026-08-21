<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
class Branch extends Model { use HasUuids; protected $fillable=['tenant_id','external_branch_id','name','code','is_active']; protected function casts():array{return ['is_active'=>'boolean'];} public function tenant():BelongsTo{return $this->belongsTo(Tenant::class);} public function users():BelongsToMany{return $this->belongsToMany(User::class)->withTimestamps();} }
