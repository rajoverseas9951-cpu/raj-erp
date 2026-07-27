<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use App\Models\Permission;
use Illuminate\Support\Facades\Schema;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Gate::before(static fn (User $user, string $ability): ?bool => $user->is_admin || $user->hasPermission($ability) ? true : null);
        Schema::hasTable('permissions') && Permission::query()->pluck('name')->each(static fn (string $permission) => Gate::define($permission, static fn (User $user) => $user->hasPermission($permission)));
        RateLimiter::for('login', static fn (Request $request) => Limit::perMinute(5)->by($request->ip().$request->input('email')));
        RateLimiter::for('passwords', static fn (Request $request) => Limit::perMinute(3)->by($request->ip().$request->input('email')));
    }
}
