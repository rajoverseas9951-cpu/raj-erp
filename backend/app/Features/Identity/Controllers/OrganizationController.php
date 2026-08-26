<?php

namespace App\Features\Identity\Controllers;

use App\Models\ErpModuleEntitlement;
use App\Models\ErpModulePreference;
use App\Models\Tenant;
use App\Support\ErpControl\ErpModule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

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

        if ($request->has('module_key')) {
            abort_unless((bool) $request->user()->is_admin, 403, 'Only ERP administrators can change module settings.');
            $validKeys = array_map(fn (ErpModule $module) => $module->value, ErpModule::cases());
            $moduleData = $request->validate([
                'module_key' => ['required', 'string', Rule::in($validKeys)],
                'is_enabled' => ['required', 'boolean'],
            ]);

            $hasEntitlements = ErpModuleEntitlement::query()->where('tenant_id', $tenant->id)->whereNull('branch_id')->exists();
            if ($hasEntitlements && $moduleData['is_enabled']) {
                $allowed = (bool) ErpModuleEntitlement::query()
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('branch_id')
                    ->where('module_key', $moduleData['module_key'])
                    ->value('is_enabled');
                abort_unless($allowed, 422, 'This module is not enabled for this ERP subscription.');
            }

            ErpModulePreference::query()->updateOrCreate(
                ['tenant_id' => $tenant->id, 'module_key' => $moduleData['module_key']],
                ['is_enabled' => $moduleData['is_enabled'], 'updated_by' => $request->user()->id],
            );

            return response()->json(['success' => true, 'message' => 'ERP module setting updated.', 'data' => $this->data($tenant)]);
        }

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
        $entitlements = ErpModuleEntitlement::query()->where('tenant_id', $tenant->id)->whereNull('branch_id')->get()->keyBy('module_key');
        $preferences = ErpModulePreference::query()->where('tenant_id', $tenant->id)->get()->keyBy('module_key');
        $hasEntitlements = $entitlements->isNotEmpty();
        $modules = collect(ErpModule::cases())->map(function (ErpModule $module) use ($entitlements, $preferences, $hasEntitlements) {
            $allowed = !$hasEntitlements || (bool) optional($entitlements->get($module->value))->is_enabled;
            $preference = $preferences->get($module->value);
            return [
                'key' => $module->value,
                'allowed' => $allowed,
                'enabled' => $allowed && ($preference ? (bool) $preference->is_enabled : true),
            ];
        })->values()->all();

        return [
            'id' => $tenant->id, 'name' => $tenant->name, 'brand_name' => $tenant->brand_name,
            'tagline' => $tenant->tagline, 'address' => $tenant->address, 'city' => $tenant->city,
            'state' => $tenant->state, 'pin_code' => $tenant->pin_code, 'phone' => $tenant->phone,
            'email' => $tenant->email, 'gst_number' => $tenant->gst_number,
            'logo_url' => $tenant->logo_path ? Storage::disk('public')->url($tenant->logo_path) : null,
            'modules' => $modules,
        ];
    }
}
