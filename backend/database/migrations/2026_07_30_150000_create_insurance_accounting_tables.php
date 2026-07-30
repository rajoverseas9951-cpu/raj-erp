<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('insurance_companies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->string('company_name');
            $table->string('short_code', 30)->nullable();
            $table->decimal('default_commission_percent', 8, 3)->default(0);
            $table->decimal('tds_percent', 8, 3)->default(0);
            $table->unsignedInteger('settlement_days')->default(30);
            $table->string('gst_number', 32)->nullable();
            $table->string('pan_number', 20)->nullable();
            $table->string('contact_person')->nullable();
            $table->string('mobile', 20)->nullable();
            $table->string('email')->nullable();
            $table->string('status', 20)->default('active');
            $table->uuid('ledger_id')->nullable()->index();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['tenant_id','company_name']);
        });

        Schema::create('insurance_commissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('insurance_company_id')->index();
            $table->string('statement_number')->nullable();
            $table->date('statement_date');
            $table->string('policy_number')->nullable()->index();
            $table->string('customer_name')->nullable();
            $table->decimal('gross_premium', 15, 2)->default(0);
            $table->decimal('commission_percent', 8, 3)->default(0);
            $table->decimal('gross_commission', 15, 2)->default(0);
            $table->decimal('tds_percent', 8, 3)->default(0);
            $table->decimal('tds_amount', 15, 2)->default(0);
            $table->decimal('net_receivable', 15, 2)->default(0);
            $table->decimal('received_amount', 15, 2)->default(0);
            $table->date('received_date')->nullable();
            $table->string('bank_reference')->nullable();
            $table->string('status', 20)->default('pending');
            $table->text('remarks')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('insurance_commissions');
        Schema::dropIfExists('insurance_companies');
    }
};
