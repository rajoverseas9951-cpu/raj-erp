<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_insurances', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('vehicle_id')->index();
            $table->uuid('insurance_company_id')->nullable()->index();
            $table->string('company_name');
            $table->string('company_code', 30)->nullable();
            $table->string('purchase_from');
            $table->string('policy_number')->index();
            $table->date('policy_date')->nullable();
            $table->date('issue_date');
            $table->date('expiry_date');
            $table->string('status', 30)->default('running')->index();
            $table->string('insurance_type', 50);
            $table->text('remark')->nullable();
            $table->decimal('od_premium', 15, 2)->default(0);
            $table->decimal('tp_premium', 15, 2)->default(0);
            $table->decimal('addon_premium', 15, 2)->default(0);
            $table->decimal('gst_other_charges', 15, 2)->default(0);
            $table->decimal('gross_premium', 15, 2)->default(0);
            $table->decimal('commission_percent', 8, 3)->default(0);
            $table->decimal('gross_commission', 15, 2)->default(0);
            $table->decimal('customer_discount', 15, 2)->default(0);
            $table->decimal('customer_pay', 15, 2)->default(0);
            $table->string('agent')->nullable();
            $table->decimal('agent_commission', 15, 2)->default(0);
            $table->jsonb('payment_details')->default('{}');
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->foreign('vehicle_id')->references('id')->on('vehicles')->cascadeOnDelete();
            $table->unique(['tenant_id', 'policy_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_insurances');
    }
};
