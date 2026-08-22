<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\ErpModuleEntitlement;
use App\Models\User;
use App\Support\ErpControl\ErpModule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class ErpControlProvisionController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        abort_unless((bool) $request->user()?->is_admin, 403, 'ERP control provisioning requires an administrator token.');

        $moduleKeys = array_map(fn (ErpModule $module) => $module->value, ErpModule::cases());
        $data = $request->validate([
            'external_tenant_id' => ['required', 'string', 'max:100'],
            'tenant_name' => ['required', 'string', 'max:255'],
            'tenant_code' => ['required', 'string', 'max:100'],
            'tenant_slug' => ['required', 'string', 'max:100'],
            'environment' => ['required', Rule::in(['PRODUCTION', 'STAGING', 'DEVELOPMENT'])],
            'base_url' => ['required', 'url', 'max:500'],
            'tenant_url' => ['required', 'url', 'max:500'],
            'modules' => ['required', 'array', 'min:1'],
            'modules.*' => ['required', 'string', Rule::in($moduleKeys)],
            'branches' => ['required', 'array', 'min:1'],
            'branches.*.external_branch_id' => ['required', 'string', 'max:100'],
            'branches.*.name' => ['required', 'string', 'max:255'],
            'branches.*.code' => ['required', 'string', 'max:100'],
            'admin.name' => ['required', 'string', 'max:255'],
            'admin.email' => ['required', 'email', 'max:255'],
            'admin.phone' => ['nullable', 'string', 'max:50'],
            'admin.password' => ['required', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);

        $actor = $request->user();
        $tenant = $actor->tenant;
        abort_unless($tenant, 422, 'The integration token is not assigned to a tenant.');

        $result = DB::transaction(function () use ($data, $tenant) {
            $tenant->fill([
                'name' => $data['tenant_name'],
                'brand_name' => $data['tenant_name'],
                'external_tenant_id' => $data['external_tenant_id'],
                'code' => $data['tenant_code'],
                'slug' => $data['tenant_slug'],
                'tenant_type' => 'VIMAWALLAH_INTERNAL',
                'erp_status' => 'ACTIVE',
                'erp_environment' => $data['environment'],
                'erp_base_url' => $data['base_url'],
                'erp_tenant_url' => $data['tenant_url'],
                'control_sync_version' => ((int) $tenant->control_sync_version) + 1,
                'control_synced_at' => now(),
            ])->save();

            $branchIds = [];
            foreach ($data['branches'] as $branchData) {
                $branch = Branch::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('code', $branchData['code'])
                    ->first() ?? new Branch(['tenant_id' => $tenant->id, 'code' => $branchData['code']]);

                $branch->fill([
                    'tenant_id' => $tenant->id,
                    'external_branch_id' => $branchData['external_branch_id'],
                    'name' => $branchData['name'],
                    'code' => $branchData['code'],
                    'is_active' => true,
                ])->save();
                $branchIds[] = $branch->id;
            }

            $admin = User::withTrashed()->where('email', strtolower($data['admin']['email']))->first();
            if ($admin && (string) $admin->tenant_id !== (string) $tenant->id) {
                abort(422, 'The ERP administrator email already belongs to another tenant.');
            }
            $admin ??= new User();
            if (method_exists($admin, 'trashed') && $admin->trashed()) $admin->restore();
            $admin->fill([
                'tenant_id' => $tenant->id,
                'name' => $data['admin']['name'],
                'email' => strtolower($data['admin']['email']),
                'phone' => $data['admin']['phone'] ?? null,
                'password' => $data['admin']['password'],
                'is_admin' => true,
                'is_active' => true,
                'email_verified_at' => now(),
                'has_tenant_wide_branch_access' => true,
            ])->save();
            $admin->branches()->sync($branchIds);

            ErpModuleEntitlement::query()->where('tenant_id', $tenant->id)->whereNull('branch_id')->delete();
            foreach (array_values(array_unique($data['modules'])) as $moduleKey) {
                ErpModuleEntitlement::create([
                    'tenant_id' => $tenant->id,
                    'branch_id' => null,
                    'module_key' => $moduleKey,
                    'is_enabled' => true,
                ]);
            }

            return [
                'tenant_id' => (string) $tenant->id,
                'external_tenant_id' => $data['external_tenant_id'],
                'admin_user_id' => (string) $admin->id,
                'branch_codes' => Branch::query()->whereIn('id', $branchIds)->orderBy('code')->pluck('code')->all(),
                'enabled_modules' => array_values(array_unique($data['modules'])),
                'control_sync_version' => (int) $tenant->control_sync_version,
                'synced_at' => $tenant->control_synced_at?->toISOString(),
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'ERP tenant, branches, modules, and initial administrator synchronized.',
            'data' => $result,
        ]);
    }
}
