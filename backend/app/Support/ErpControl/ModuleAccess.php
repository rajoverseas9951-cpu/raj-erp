<?php

namespace App\Support\ErpControl;

use App\Models\Branch;
use App\Models\ErpModuleEntitlement;
use App\Models\ErpModulePreference;
use App\Models\User;

class ModuleAccess
{
    public function enabled(string $tenantId, ErpModule $module, ?Branch $branch = null): bool
    {
        return $this->enabledInternal($tenantId, $module, $branch, []);
    }

    public function configured(string $tenantId, ErpModule $module): bool
    {
        $preference = ErpModulePreference::query()
            ->where('tenant_id', $tenantId)
            ->where('module_key', $module->value)
            ->value('is_enabled');

        return $preference === null ? true : (bool) $preference;
    }

    /** @return array<string> */
    public function blockedBy(string $tenantId, ErpModule $module, ?Branch $branch = null): array
    {
        return collect($module->dependencies())
            ->reject(fn (ErpModule $dependency) => $this->enabled($tenantId, $dependency, $branch))
            ->map(fn (ErpModule $dependency) => $dependency->value)
            ->values()
            ->all();
    }

    public function authorize(User $user, ErpModule $module, ?Branch $branch = null): void
    {
        abort_unless(
            $this->enabled((string) $user->tenant_id, $module, $branch),
            403,
            "The {$module->value} module is disabled for this ERP."
        );
    }

    /** @return array<string> */
    public function enabledKeys(string $tenantId): array
    {
        return collect(ErpModule::cases())
            ->filter(fn (ErpModule $module) => $this->enabled($tenantId, $module))
            ->map(fn (ErpModule $module) => $module->value)
            ->values()
            ->all();
    }

    private function enabledInternal(string $tenantId, ErpModule $module, ?Branch $branch, array $visited): bool
    {
        if (in_array($module->value, $visited, true)) {
            return false;
        }

        $visited[] = $module->value;

        if (! $this->directEnabled($tenantId, $module, $branch)) {
            return false;
        }

        foreach ($module->dependencies() as $dependency) {
            if (! $this->enabledInternal($tenantId, $dependency, $branch, $visited)) {
                return false;
            }
        }

        return true;
    }

    private function directEnabled(string $tenantId, ErpModule $module, ?Branch $branch = null): bool
    {
        $tenantQuery = ErpModuleEntitlement::query()->where('tenant_id', $tenantId);
        $platformAllowed = true;

        if ($tenantQuery->exists()) {
            if ($branch) {
                $override = (clone $tenantQuery)
                    ->where('branch_id', $branch->id)
                    ->where('module_key', $module->value)
                    ->value('is_enabled');

                if ($override !== null) {
                    $platformAllowed = (bool) $override;
                } else {
                    $platformAllowed = (bool) (clone $tenantQuery)
                        ->whereNull('branch_id')
                        ->where('module_key', $module->value)
                        ->value('is_enabled');
                }
            } else {
                $platformAllowed = (bool) (clone $tenantQuery)
                    ->whereNull('branch_id')
                    ->where('module_key', $module->value)
                    ->value('is_enabled');
            }
        }

        if (! $platformAllowed) {
            return false;
        }

        return $this->configured($tenantId, $module);
    }
}
