<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, HasUuids, Notifiable, SoftDeletes;

    protected $fillable = ['tenant_id', 'name', 'email', 'phone', 'profile_photo_path', 'password', 'is_admin', 'is_active', 'email_verified_at', 'has_tenant_wide_branch_access'];
    protected $hidden = ['password', 'remember_token'];
    protected function casts(): array { return ['email_verified_at' => 'datetime', 'password' => 'hashed', 'is_admin' => 'boolean', 'is_active' => 'boolean', 'has_tenant_wide_branch_access' => 'boolean']; }

    public function roles(): BelongsToMany { return $this->belongsToMany(Role::class); }
    public function tenant(): BelongsTo { return $this->belongsTo(Tenant::class); }
    public function branches(): BelongsToMany { return $this->belongsToMany(Branch::class)->withTimestamps(); }
    public function hasPermission(string $permission): bool { return $this->is_admin || $this->roles()->whereHas('permissions', fn ($query) => $query->where('name', $permission))->exists(); }
}
