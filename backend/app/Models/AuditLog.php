<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class AuditLog extends Model { use HasUuids; protected $fillable=['tenant_id','actor_id','action','auditable_type','auditable_id','before','after','ip_address','user_agent']; protected function casts(): array { return ['before'=>'array','after'=>'array']; } }
