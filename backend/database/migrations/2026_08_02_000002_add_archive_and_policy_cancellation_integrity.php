<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->timestampTz('archived_at')->nullable()->index();
            $table->uuid('archived_by')->nullable()->index();
        });
        Schema::table('vehicle_insurances', function (Blueprint $table) {
            $table->timestampTz('archived_at')->nullable()->index();
            $table->uuid('archived_by')->nullable()->index();
            $table->timestampTz('cancelled_at')->nullable()->index();
            $table->uuid('cancelled_by')->nullable()->index();
            $table->text('cancellation_reason')->nullable();
            $table->decimal('refund_amount', 15, 2)->default(0);
            $table->decimal('cancellation_charges', 15, 2)->default(0);
        });
        Schema::create('insurance_commission_reversals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('policy_id')->index();
            $table->uuid('commission_id')->nullable()->index();
            $table->date('reversal_date')->index();
            $table->decimal('gross_commission', 15, 2)->default(0);
            $table->decimal('tds_amount', 15, 2)->default(0);
            $table->decimal('net_receivable', 15, 2)->default(0);
            $table->decimal('received_amount', 15, 2)->default(0);
            $table->text('reason');
            $table->uuid('created_by')->nullable()->index();
            $table->timestampsTz();
            $table->unique(['tenant_id', 'policy_id']);
            $table->foreign('policy_id')->references('id')->on('vehicle_insurances')->restrictOnDelete();
        });
        Schema::table('accounting_vouchers', function (Blueprint $table) {
            $table->uuid('policy_id')->nullable()->index();
            $table->uuid('reversal_of_id')->nullable()->unique();
            $table->foreign('policy_id')->references('id')->on('vehicle_insurances')->restrictOnDelete();
            $table->foreign('reversal_of_id')->references('id')->on('accounting_vouchers')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('accounting_vouchers', function (Blueprint $table) {
            $table->dropForeign(['policy_id']);
            $table->dropForeign(['reversal_of_id']);
            $table->dropUnique(['reversal_of_id']);
            $table->dropColumn(['policy_id', 'reversal_of_id']);
        });
        Schema::dropIfExists('insurance_commission_reversals');
        Schema::table('vehicle_insurances', function (Blueprint $table) {
            $table->dropColumn(['archived_at', 'archived_by', 'cancelled_at', 'cancelled_by', 'cancellation_reason', 'refund_amount', 'cancellation_charges']);
        });
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn(['archived_at', 'archived_by']);
        });
    }
};
