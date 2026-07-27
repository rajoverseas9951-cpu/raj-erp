<?php
namespace App\Features\Identity\Controllers;
use App\Features\Identity\Repositories\RoleRepository; use App\Features\Identity\Resources\RoleResource; use App\Http\Controllers\Controller; use Illuminate\Http\Request;
class RoleController extends Controller { public function __construct(private RoleRepository $roles){} public function index(Request $r){abort_unless($r->user()->can('users.view'),403);return RoleResource::collection($this->roles->all($r->user()->tenant_id));} }
