<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('service_works')) return;
        Schema::create('service_works', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('customer_id')->nullable()->index();
            $table->string('service_type', 40)->index();
            $table->string('work_type')->nullable();
            $table->string('application_number')->nullable()->index();
            $table->date('work_date')->index();
            $table->decimal('amount', 14, 2)->default(0);
            $table->decimal('cost', 14, 2)->default(0);
            $table->decimal('received_amount', 14, 2)->default(0);
            $table->string('status', 40)->default('active')->index();
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();
            $table->index(['tenant_id','service_type','work_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_works');
    }
};
