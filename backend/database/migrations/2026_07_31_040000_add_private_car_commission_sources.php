<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('insurance_companies', function (Blueprint $table) {
            $table->string('agency_code_name')->nullable();
            $table->text('notes')->nullable();
        });

        Schema::create('insurance_purchase_sources', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->string('name');
            $table->string('source_type', 40);
            $table->string('mobile', 20)->nullable();
            $table->string('email')->nullable();
            $table->uuid('linked_company_id')->nullable()->index();
            $table->boolean('tds_applicable')->default(false);
            $table->decimal('tds_percent', 8, 3)->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['tenant_id', 'name']);
        });

        Schema::table('vehicle_insurances', function (Blueprint $table) {
            $table->string('purchase_from_type', 30)->default('direct_company');
            $table->uuid('purchase_source_id')->nullable()->index();
            $table->string('commission_receivable_from_type', 30)->nullable();
            $table->uuid('commission_receivable_from_id')->nullable()->index();
            $table->string('commission_basis', 30)->nullable();
            $table->foreign('purchase_source_id')->references('id')->on('insurance_purchase_sources')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('vehicle_insurances', function (Blueprint $table) {
            $table->dropForeign(['purchase_source_id']);
            $table->dropColumn([
                'purchase_from_type', 'purchase_source_id', 'commission_receivable_from_type',
                'commission_receivable_from_id', 'commission_basis',
            ]);
        });
        Schema::dropIfExists('insurance_purchase_sources');
        Schema::table('insurance_companies', fn (Blueprint $table) => $table->dropColumn(['agency_code_name', 'notes']));
    }
};
