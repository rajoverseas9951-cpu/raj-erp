<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $common = function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('vehicle_id')->index();
            $table->string('period')->nullable();
            $table->string('reference_number')->nullable()->index();
            $table->date('receipt_date')->nullable();
            $table->date('issue_date')->nullable();
            $table->date('expiry_date')->nullable()->index();
            $table->decimal('amount', 14, 2)->default(0);
            $table->decimal('party_amount', 14, 2)->default(0);
            $table->string('status', 40)->nullable()->index();
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();
            $table->foreign('vehicle_id')->references('id')->on('vehicles')->cascadeOnDelete();
        };
        foreach (['vehicle_pucs', 'vehicle_fitnesses', 'vehicle_taxes'] as $name) {
            Schema::create($name, $common);
        }
        Schema::create('vehicle_permits', function (Blueprint $t) use ($common) {
            $common($t);
            $t->string('permit_type');
            $t->string('state')->nullable();
        });
        Schema::create('vehicle_counter_taxes', function (Blueprint $t) use ($common) {
            $common($t);
            $t->string('dealer_name')->nullable();
            $t->decimal('dealer_amount', 14, 2)->default(0);
        });
        Schema::create('vehicle_hsrp_records', function (Blueprint $t) use ($common) {
            $common($t);
            $t->string('party_name')->nullable();
            $t->date('order_date')->nullable();
            $t->date('received_date')->nullable();
            $t->date('delivery_date')->nullable();
            $t->string('vendor')->nullable();
        });
        Schema::create('vehicle_sld_records', function (Blueprint $t) use ($common) {
            $common($t);
            $t->string('vendor')->nullable();
            $t->date('fitment_date')->nullable();
        });
        Schema::create('vehicle_rto_processes', function (Blueprint $t) use ($common) {
            $common($t);
            $t->string('work_type');
            $t->date('process_date')->nullable();
            $t->string('rto_office')->nullable();
            $t->string('broker')->nullable();
            $t->string('assigned_agent')->nullable();
            $t->string('external_agent')->nullable();
            $t->decimal('agent_amount', 14, 2)->default(0);
            $t->boolean('faceless_appointment')->default(false);
            $t->date('approval_date')->nullable();
            $t->date('rc_received_date')->nullable();
            $t->date('rc_delivered_date')->nullable();
            $t->string('invoice_number')->nullable();
        });
        Schema::create('vehicle_transfer_processes', function (Blueprint $t) use ($common) {
            $common($t);
            $t->uuid('current_customer_id')->nullable();
            $t->uuid('new_customer_id')->nullable();
            $t->string('new_owner_name')->nullable();
            $t->date('application_date')->nullable();
            $t->date('completion_date')->nullable();
            $t->boolean('owner_change_confirmed')->default(false);
        });
        foreach (['vehicle_payments', 'vehicle_agent_payments', 'vehicle_other_payments'] as $name) {
            Schema::create($name, function (Blueprint $t) use ($common) {
                $common($t);
                $t->uuid('rto_process_id')->nullable();
                $t->uuid('voucher_id')->nullable()->index();
                $t->uuid('ledger_id')->nullable()->index();
                $t->string('payment_type')->nullable();
                $t->string('account')->nullable();
                $t->string('purpose')->nullable();
                $t->decimal('billed_amount', 14, 2)->default(0);
                $t->decimal('paid_amount', 14, 2)->default(0);
                $t->string('party_name')->nullable();
            });
        }
        Schema::create('vehicle_operation_documents', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('tenant_id')->index();
            $t->uuid('vehicle_id')->index();
            $t->string('module', 40);
            $t->uuid('record_id')->index();
            $t->string('path');
            $t->string('original_name');
            $t->string('mime_type', 100);
            $t->unsignedBigInteger('size_bytes');
            $t->uuid('uploaded_by')->nullable();
            $t->timestampsTz();
            $t->softDeletesTz();
        });
        Schema::create('vehicle_module_overrides', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('tenant_id')->index();
            $t->uuid('vehicle_id')->index();
            $t->string('module', 40);
            $t->boolean('enabled');
            $t->text('reason')->nullable();
            $t->uuid('created_by')->nullable();
            $t->timestampsTz();
            $t->softDeletesTz();
            $t->unique(['tenant_id', 'vehicle_id', 'module']);
        });
        Schema::create('vehicle_operation_masters', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('tenant_id')->index();
            $t->string('type', 40)->index();
            $t->string('name');
            $t->string('code')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestampsTz();
            $t->softDeletesTz();
            $t->unique(['tenant_id', 'type', 'name']);
        });
        if (Schema::hasTable('permissions')) {
            foreach (['vehicle.financial.view', 'vehicle.financial.edit', 'vehicle.documents'] as $name) {
                if (! DB::table('permissions')->where('name', $name)->exists()) {
                    DB::table('permissions')->insert(['id' => (string) Str::uuid(), 'name' => $name, 'description' => ucfirst(str_replace('.', ' ', $name)), 'created_at' => now(), 'updated_at' => now()]);
                }
                $permissionId = DB::table('permissions')->where('name', $name)->value('id');
                foreach (DB::table('roles')->whereIn('slug', ['admin', 'administrator'])->pluck('id') as $roleId) {
                    DB::table('permission_role')->insertOrIgnore(['permission_id' => $permissionId, 'role_id' => $roleId]);
                }
            }
        }
    }

    public function down(): void
    {
        foreach (['vehicle_operation_masters', 'vehicle_module_overrides', 'vehicle_operation_documents', 'vehicle_other_payments', 'vehicle_agent_payments', 'vehicle_payments', 'vehicle_transfer_processes', 'vehicle_rto_processes', 'vehicle_sld_records', 'vehicle_hsrp_records', 'vehicle_counter_taxes', 'vehicle_permits', 'vehicle_taxes', 'vehicle_fitnesses', 'vehicle_pucs'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
