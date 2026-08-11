<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('other_insurance_policies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('customer_id')->nullable()->index();
            $table->string('insurance_line', 30)->index(); // non_motor, health, life
            $table->string('product_type', 120)->nullable()->index();
            $table->string('customer_name', 255)->nullable();
            $table->string('mobile', 20)->nullable()->index();
            $table->string('company_name', 255)->nullable()->index();
            $table->string('policy_number', 120)->nullable()->index();
            $table->string('proposal_number', 120)->nullable();
            $table->date('issue_date')->nullable();
            $table->date('expiry_date')->nullable()->index();
            $table->decimal('sum_insured', 16, 2)->default(0);
            $table->decimal('gross_premium', 16, 2)->default(0);
            $table->decimal('commission_amount', 16, 2)->default(0);
            $table->decimal('agent_commission', 16, 2)->default(0);
            $table->decimal('received_amount', 16, 2)->default(0);
            $table->string('status', 40)->default('active')->index();
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('other_insurance_policies');
    }
};
