<?php

namespace App\Features\Identity\Controllers;

use App\Http\Controllers\Controller;
use App\Models\ErpModuleEntitlement;
use App\Models\ErpModulePreference;
use App\Support\ErpControl\ErpModule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ModulePreferenceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = (string) $user->tenant_id;
        $entitlementRows = ErpModuleEntitlement::query()
            ->where('tenant_id', $tenantId)
            ->whereNull('branch_id')
            ->get()
            ->keyBy('module_key');
        $preferences = ErpModulePreference::query()
            ->where('tenant_id', $tenantId)
            ->get()
            ->keyBy('module_key');

        $hasEntitlements = $entitlementRows->isNotEmpty();
        $modules = collect(ErpModule::cases())->map(function (ErpModule $module) use ($entitlementRows, $preferences, $hasEntitlements) {
            $allowed = !$hasEntitlements || (bool) optional($entitlementRows->get($module->value))->is_enabled;
            $preference = $preferences->get($module->value);
            $enabled = $allowed && ($preference ? (bool) $preference->is_enabled : true);

            return [
                'key' => $module->value,
                'allowed' => $allowed,
                'enabled' => $enabled,
                'source' => $preference ? 'erp' : 'default',
            ];
        })->values();

        return response()->json(['modules' => $modules]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless((bool) $user->is_admin, 403, 'Only ERP administrators can change module settings.');

        $validKeys = array_map(fn (ErpModule $module) => $module->value, ErpModule::cases());
        $validated = $request->validate([
            'module_key' => ['required', 'string', Rule::in($validKeys)],
            'is_enabled' => ['required', 'boolean'],
        ]);

        $tenantId = (string) $user->tenant_id;
        $hasEntitlements = ErpModuleEntitlement::query()->where('tenant_id', $tenantId)->whereNull('branch_id')->exists();
        if ($hasEntitlements && $validated['is_enabled']) {
            $allowed = (bool) ErpModuleEntitlement::query()
                ->where('tenant_id', $tenantId)
                ->whereNull('branch_id')
                ->where('module_key', $validated['module_key'])
                ->value('is_enabled');
            abort_unless($allowed, 422, 'This module is not enabled for this ERP subscription.');
        }

        $preference = ErpModulePreference::query()->updateOrCreate(
            ['tenant_id' => $tenantId, 'module_key' => $validated['module_key']],
            ['is_enabled' => $validated['is_enabled'], 'updated_by' => $user->id],
        );

        return response()->json([
            'key' => $preference->module_key,
            'enabled' => (bool) $preference->is_enabled,
        ]);
    }
}
