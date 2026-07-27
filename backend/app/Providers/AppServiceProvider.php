<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Gate::before(static fn (User $user): ?bool => $user->is_admin ? true : null);
        RateLimiter::for('login', static fn (Request $request) => Limit::perMinute(5)->by($request->ip().$request->input('email')));
    }
}
