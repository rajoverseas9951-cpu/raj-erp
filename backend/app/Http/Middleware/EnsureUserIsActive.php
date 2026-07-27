<?php
namespace App\Http\Middleware;
use Closure; use Illuminate\Http\Request; use Symfony\Component\HttpFoundation\Response;
class EnsureUserIsActive { public function handle(Request $request,Closure $next):Response { if(!$request->user()?->is_active){$request->user()?->currentAccessToken()?->delete();return response()->json(['success'=>false,'error'=>['code'=>'ACCOUNT_DISABLED','message'=>'This account is disabled.']],403);} return $next($request); } }
