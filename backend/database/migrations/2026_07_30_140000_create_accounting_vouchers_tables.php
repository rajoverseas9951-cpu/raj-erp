<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('accounting_vouchers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->string('voucher_number', 60);
            $table->enum('voucher_type', ['receipt','payment','contra','journal','sales','purchase']);
            $table->date('voucher_date')->index();
            $table->string('reference_number', 100)->nullable();
            $table->text('narration')->nullable();
            $table->decimal('total_debit', 18, 2)->default(0);
            $table->decimal('total_credit', 18, 2)->default(0);
            $table->enum('status', ['draft','posted','cancelled'])->default('posted');
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['tenant_id','voucher_number']);
        });

        Schema::create('accounting_voucher_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('voucher_id')->index();
            $table->uuid('ledger_id')->index();
            $table->enum('entry_type', ['debit','credit']);
            $table->decimal('amount', 18, 2);
            $table->text('description')->nullable();
            $table->timestamps();
            $table->foreign('voucher_id')->references('id')->on('accounting_vouchers')->cascadeOnDelete();
            $table->foreign('ledger_id')->references('id')->on('ledgers')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_voucher_entries');
        Schema::dropIfExists('accounting_vouchers');
    }
};
