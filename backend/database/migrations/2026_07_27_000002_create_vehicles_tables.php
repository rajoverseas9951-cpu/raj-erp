<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('customer_id')->index();
            $table->string('vehicle_number')->index();
            $table->date('registration_date')->nullable();
            $table->string('registration_authority')->nullable();
            $table->string('state')->nullable()->index();
            $table->string('district')->nullable()->index();
            $table->string('vehicle_class')->nullable();
            $table->string('vehicle_category')->nullable()->index();
            $table->string('vehicle_type')->nullable()->index();
            $table->string('manufacturer')->nullable()->index();
            $table->string('model')->nullable()->index();
            $table->string('variant')->nullable();
            $table->unsignedSmallInteger('manufacturing_year')->nullable();
            $table->string('colour')->nullable();
            $table->string('fuel_type')->nullable()->index();
            $table->unsignedSmallInteger('seating_capacity')->nullable();
            $table->unsignedInteger('cubic_capacity')->nullable();
            $table->unsignedInteger('gross_weight')->nullable();
            $table->unsignedInteger('unladen_weight')->nullable();
            $table->string('chassis_number')->index();
            $table->string('engine_number')->index();
            $table->boolean('hypothecation')->default(false);
            $table->string('financier')->nullable();
            $table->string('insurance_status', 32)->default('not_added')->index();
            $table->string('fitness_status', 32)->default('not_added')->index();
            $table->string('permit_status', 32)->default('not_added')->index();
            $table->string('tax_status', 32)->default('not_added')->index();
            $table->string('puc_status', 32)->default('not_added')->index();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();
            $table->unique(['tenant_id', 'vehicle_number']);
        });
        Schema::create('vehicle_documents', function (Blueprint $table) {
            $table->uuid('id')->primary(); $table->uuid('tenant_id')->index(); $table->uuid('vehicle_id')->index();
            $table->string('document_type', 64)->index(); $table->string('file_id'); $table->string('file_name');
            $table->string('mime_type')->nullable(); $table->unsignedBigInteger('size_bytes')->nullable(); $table->uuid('uploaded_by')->nullable();
            $table->timestampsTz(); $table->softDeletesTz(); $table->foreign('vehicle_id')->references('id')->on('vehicles')->cascadeOnDelete();
        });
        Schema::create('vehicle_timeline_events', function (Blueprint $table) {
            $table->uuid('id')->primary(); $table->uuid('tenant_id')->index(); $table->uuid('vehicle_id')->index(); $table->uuid('actor_id')->nullable()->index();
            $table->string('event_type', 64)->index(); $table->string('title'); $table->text('description')->nullable(); $table->jsonb('metadata')->default('{}'); $table->timestampsTz();
            $table->foreign('vehicle_id')->references('id')->on('vehicles')->cascadeOnDelete();
        });
    }
    public function down(): void { Schema::dropIfExists('vehicle_timeline_events'); Schema::dropIfExists('vehicle_documents'); Schema::dropIfExists('vehicles'); }
};
