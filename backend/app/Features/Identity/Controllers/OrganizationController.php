<?php

namespace App\Features\Identity\Controllers;

use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrganizationController
{
    public function show(Request $request): JsonResponse
    {
        $tenant = Tenant::query()->findOrFail($request->user()->tenant_id);

        return response()->json(['success' => true, 'data' => ['id' => $tenant->id, 'name' => $tenant->name, 'brand_name' => $tenant->brand_name, 'tagline' => $tenant->tagline, 'email' => $tenant->email]]);
    }
}
