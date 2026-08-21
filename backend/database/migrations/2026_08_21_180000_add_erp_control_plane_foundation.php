<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('external_tenant_id', 120)->nullable()->unique();
            $table->string('code', 80)->nullable()->unique();
            $table->string('slug', 120)->nullable()->unique();
            $table->string('tenant_type', 40)->default('VIMAWALLAH_INTERNAL');
            $table->string('erp_status', 20)->default('ACTIVE');
            $table->string('erp_environment', 20)->default('DEVELOPMENT');
            $table->string('erp_base_url')->default('https://erp.vimawallah.com');
            $table->string('erp_tenant_url')->default('https://erp.vimawallah.com');
            $table->unsignedBigInteger('control_sync_version')->default(0);
            $table->timestamp('control_synced_at')->nullable();
        });
        Schema::table('users', fn (Blueprint $table) => $table->boolean('has_tenant_wide_branch_access')->default(true));

        Schema::create('branches', function (Blueprint $table) {
            $table->uuid('id')->primary(); $table->uuid('tenant_id')->index(); $table->string('name', 160); $table->string('code', 80);
            $table->string('external_branch_id', 120)->nullable(); $table->boolean('is_active')->default(true); $table->timestamps();
            $table->unique(['tenant_id', 'code']); $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
        });
        Schema::create('branch_user', function (Blueprint $table) {
            $table->uuid('branch_id'); $table->uuid('user_id'); $table->timestamps(); $table->primary(['branch_id', 'user_id']);
            $table->foreign('branch_id')->references('id')->on('branches')->cascadeOnDelete(); $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
        Schema::create('erp_module_entitlements', function (Blueprint $table) {
            $table->uuid('id')->primary(); $table->uuid('tenant_id')->index(); $table->uuid('branch_id')->nullable()->index();
            $table->string('module_key', 40); $table->boolean('is_enabled')->default(false); $table->timestamps();
            $table->unique(['tenant_id', 'branch_id', 'module_key']); $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete(); $table->foreign('branch_id')->references('id')->on('branches')->cascadeOnDelete();
        });

        $tenant = DB::table('tenants')->where('id', env('ADMIN_TENANT_ID'))->first() ?? DB::table('tenants')->orderBy('created_at')->first();
        if ($tenant) {
            DB::table('tenants')->where('id', $tenant->id)->update(['code' => 'VIMAWALLAH', 'slug' => 'vimawallah', 'tenant_type' => 'VIMAWALLAH_INTERNAL', 'erp_status' => 'ACTIVE', 'erp_environment' => app()->environment('production') ? 'PRODUCTION' : 'DEVELOPMENT', 'erp_base_url' => 'https://erp.vimawallah.com', 'erp_tenant_url' => 'https://erp.vimawallah.com']);
            foreach ([['Dhanera', 'VIMA-DHN-001'], ['Tharad', 'VIMA-THR-002']] as [$name, $code]) DB::table('branches')->insert(['id' => (string) Str::uuid(), 'tenant_id' => $tenant->id, 'name' => $name, 'code' => $code, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
            $enabled = ['CUSTOMERS','VEHICLES','POLICIES','RENEWALS','DOCUMENTS','REPORTS'];
            foreach (['CUSTOMERS','VEHICLES','POLICIES','RENEWALS','CLAIMS','RTO','ACCOUNTING','DOCUMENTS','REPORTS','AGENTS','DEALERS','FLEET','WHATSAPP','RC_API','PAYMENTS'] as $key) DB::table('erp_module_entitlements')->insert(['id' => (string) Str::uuid(), 'tenant_id' => $tenant->id, 'branch_id' => null, 'module_key' => $key, 'is_enabled' => in_array($key, $enabled, true), 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_module_entitlements'); Schema::dropIfExists('branch_user'); Schema::dropIfExists('branches');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('has_tenant_wide_branch_access'));
        Schema::table('tenants', fn (Blueprint $table) => $table->dropColumn(['external_tenant_id','code','slug','tenant_type','erp_status','erp_environment','erp_base_url','erp_tenant_url','control_sync_version','control_synced_at']));
    }
};
