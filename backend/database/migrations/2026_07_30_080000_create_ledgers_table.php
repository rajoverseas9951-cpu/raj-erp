<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ledgers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('customer_id')->nullable()->unique();
            $table->string('ledger_name', 200);
            $table->string('ledger_group', 80)->default('sundry_debtors');
            $table->decimal('opening_balance', 15, 2)->default(0);
            $table->string('balance_type', 10)->default('debit');
            $table->decimal('credit_limit', 15, 2)->nullable();
            $table->unsignedInteger('credit_days')->nullable();
            $table->boolean('gst_applicable')->default(false);
            $table->string('status', 20)->default('active');
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'ledger_group']);
            $table->index(['tenant_id', 'ledger_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledgers');
    }
};
