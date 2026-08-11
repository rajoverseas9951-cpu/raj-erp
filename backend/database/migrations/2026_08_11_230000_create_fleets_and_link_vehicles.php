<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('fleets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->string('fleet_code', 40)->index();
            $table->string('fleet_name', 180)->index();
            $table->string('business_name', 220)->nullable();
            $table->uuid('primary_customer_id')->nullable()->index();
            $table->string('fleet_type', 60)->default('transport')->index();
            $table->string('contact_person', 160)->nullable();
            $table->string('mobile', 20)->nullable()->index();
            $table->string('alternate_mobile', 20)->nullable();
            $table->string('gst_number', 30)->nullable();
            $table->text('address')->nullable();
            $table->boolean('credit_allowed')->default(false);
            $table->decimal('credit_limit', 16, 2)->default(0);
            $table->string('default_broker', 180)->nullable();
            $table->string('default_agent', 180)->nullable();
            $table->string('status', 30)->default('active')->index();
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();
            $table->unique(['tenant_id','fleet_code']);
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->uuid('fleet_id')->nullable()->index()->after('customer_id');
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) { $table->dropColumn('fleet_id'); });
        Schema::dropIfExists('fleets');
    }
};