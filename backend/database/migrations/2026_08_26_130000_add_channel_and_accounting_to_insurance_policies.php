<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_insurances', function (Blueprint $table) {
            $table->string('business_channel', 20)->default('retail')->index();
        });

        Schema::table('other_insurance_policies', function (Blueprint $table) {
            $table->string('business_channel', 20)->default('retail')->index();
            $table->uuid('insurance_company_id')->nullable()->index();
            $table->string('purchase_from_type', 30)->default('direct_company');
            $table->uuid('purchase_source_id')->nullable()->index();
            $table->string('commission_receivable_from_type', 30)->nullable();
            $table->uuid('commission_receivable_from_id')->nullable()->index();
            $table->decimal('commission_percent', 8, 3)->default(0);
            $table->decimal('customer_pay', 16, 2)->default(0);
            $table->decimal('customer_due', 16, 2)->default(0);
            $table->decimal('company_payable', 16, 2)->default(0);
            $table->string('payment_status', 30)->default('pending')->index();
            $table->uuid('updated_by')->nullable();

            $table->foreign('insurance_company_id')->references('id')->on('insurance_companies')->nullOnDelete();
            $table->foreign('purchase_source_id')->references('id')->on('insurance_purchase_sources')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('other_insurance_policies', function (Blueprint $table) {
            $table->dropForeign(['insurance_company_id']);
            $table->dropForeign(['purchase_source_id']);
            $table->dropColumn([
                'business_channel', 'insurance_company_id', 'purchase_from_type', 'purchase_source_id',
                'commission_receivable_from_type', 'commission_receivable_from_id', 'commission_percent',
                'customer_pay', 'customer_due', 'company_payable', 'payment_status', 'updated_by',
            ]);
        });

        Schema::table('vehicle_insurances', function (Blueprint $table) {
            $table->dropColumn('business_channel');
        });
    }
};
