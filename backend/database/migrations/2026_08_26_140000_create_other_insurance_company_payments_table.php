<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('other_insurance_company_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('policy_id')->index();
            $table->decimal('amount', 16, 2);
            $table->date('payment_date')->index();
            $table->string('payment_mode', 40)->default('office_bank');
            $table->uuid('bank_ledger_id')->nullable()->index();
            $table->string('paid_to')->nullable();
            $table->string('reference_number', 150)->nullable();
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->foreign('policy_id')->references('id')->on('other_insurance_policies')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('other_insurance_company_payments');
    }
};
