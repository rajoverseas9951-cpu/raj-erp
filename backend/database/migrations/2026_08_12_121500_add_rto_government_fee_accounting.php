<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('vehicle_rto_processes', function (Blueprint $table) {
            $table->decimal('government_fee', 12, 2)->default(0);
            $table->string('government_fee_paid_by', 20)->default('owner');
            $table->uuid('government_fee_bank_ledger_id')->nullable();
            $table->decimal('customer_bill_amount', 12, 2)->default(0);
            $table->uuid('invoice_voucher_id')->nullable();
            $table->uuid('government_fee_voucher_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('vehicle_rto_processes', function (Blueprint $table) {
            $table->dropColumn([
                'government_fee',
                'government_fee_paid_by',
                'government_fee_bank_ledger_id',
                'customer_bill_amount',
                'invoice_voucher_id',
                'government_fee_voucher_id',
            ]);
        });
    }
};
