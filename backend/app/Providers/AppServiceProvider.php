<?php
namespace App\Providers;
use App\Models\User; use Illuminate\Support\Facades\Gate; use Illuminate\Support\ServiceProvider;
class AppServiceProvider extends ServiceProvider { public function register(): void {} public function boot(): void { Gate::before(fn(User $user,string $ability) => in_array('*',$user->permissions ?? [],true) || in_array($ability,$user->permissions ?? [],true) ? true : null); } }
