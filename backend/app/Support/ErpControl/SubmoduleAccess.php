<?php

namespace App\Support\ErpControl;

use App\Models\ErpModulePreference;
use App\Models\User;

class SubmoduleAccess
{
    public function configured(string $tenantId, ErpSubmodule $submodule): bool
    {
        $preference = ErpModulePreference::query()
            ->where('tenant_id', $tenantId)
            ->where('module_key', $submodule->value)
            ->value('is_enabled');

        return $preference === null ? true : (bool) $preference;
    }

    public function enabled(string $tenantId, ErpSubmodule $submodule): bool
    {
        if (! app(ModuleAccess::class)->enabled($tenantId, $submodule->parent())) {
            return false;
        }

        return $this->configured($tenantId, $submodule);
    }

    /** @return array<string> */
    public function blockedBy(string $tenantId, ErpSubmodule $submodule): array
    {
        if (! app(ModuleAccess::class)->enabled($tenantId, $submodule->parent())) {
            return [$submodule->parent()->value];
        }

        return [];
    }

    public function authorize(User $user, ErpSubmodule $submodule): void
    {
        abort_unless(
            $this->enabled((string) $user->tenant_id, $submodule),
            403,
            "The {$submodule->value} submodule is disabled for this ERP."
        );
    }
}
