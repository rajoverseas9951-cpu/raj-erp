<?php

namespace App\Features\Identity\Controllers;

use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class OrganizationController
{
    public function show(Request $request): JsonResponse
    {
        $tenant = Tenant::query()->findOrFail($request->user()->tenant_id);

        return response()->json(['success' => true, 'data' => $this->data($tenant)]);
    }

    public function update(Request $request): JsonResponse
    {
        $tenant = Tenant::query()->findOrFail($request->user()->tenant_id);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'brand_name' => ['required', 'string', 'max:120'],
            'tagline' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:1000'],
            'city' => ['nullable', 'string', 'max:120'],
            'state' => ['nullable', 'string', 'max:120'],
            'pin_code' => ['nullable', 'regex:/^[1-9][0-9]{5}$/'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email:rfc', 'max:255'],
            'gst_number' => ['nullable', 'string', 'max:32'],
            'logo' => ['nullable', 'file', 'mimetypes:image/jpeg,image/png,image/webp', 'max:2048'],
        ]);

        if ($request->hasFile('logo')) {
            if ($tenant->logo_path) Storage::disk('public')->delete($tenant->logo_path);
            $data['logo_path'] = $request->file('logo')->store("organizations/{$tenant->id}", 'public');
        }
        unset($data['logo']);
        $tenant->update($data);

        return response()->json(['success' => true, 'message' => 'Organization settings updated.', 'data' => $this->data($tenant->fresh())]);
    }

    private function data(Tenant $tenant): array
    {
        return [
            'id' => $tenant->id, 'name' => $tenant->name, 'brand_name' => $tenant->brand_name,
            'tagline' => $tenant->tagline, 'address' => $tenant->address, 'city' => $tenant->city,
            'state' => $tenant->state, 'pin_code' => $tenant->pin_code, 'phone' => $tenant->phone,
            'email' => $tenant->email, 'gst_number' => $tenant->gst_number,
            'logo_url' => $tenant->logo_path ? Storage::disk('public')->url($tenant->logo_path) : null,
        ];
    }
}
