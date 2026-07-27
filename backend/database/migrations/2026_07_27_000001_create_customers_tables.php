<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->string('customer_code')->index();
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');
            $table->string('mobile', 20)->index();
            $table->string('alternate_mobile', 20)->nullable();
            $table->string('whatsapp', 20)->nullable();
            $table->string('email')->nullable()->index();
            $table->date('date_of_birth')->nullable();
            $table->string('gender', 32)->nullable();
            $table->string('photo_file_id')->nullable();
            $table->string('aadhaar_number', 20)->nullable();
            $table->string('pan_number', 20)->nullable();
            $table->string('driving_licence_number')->nullable();
            $table->string('passport_number')->nullable();
            $table->string('voter_id')->nullable();
            $table->text('current_address')->nullable();
            $table->text('permanent_address')->nullable();
            $table->string('city')->nullable()->index();
            $table->string('district')->nullable();
            $table->string('state')->nullable()->index();
            $table->string('pincode', 12)->nullable();
            $table->string('occupation')->nullable();
            $table->string('company_name')->nullable();
            $table->string('gst_number')->nullable()->index();
            $table->text('remarks')->nullable();
            $table->jsonb('tags')->default('[]');
            $table->string('priority', 32)->default('normal')->index();
            $table->string('status', 32)->default('active')->index();
            $table->unsignedInteger('vehicles_count')->default(0);
            $table->unsignedInteger('insurance_policies_count')->default(0);
            $table->unsignedInteger('rto_files_count')->default(0);
            $table->uuid('assigned_to')->nullable()->index();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();
            $table->unique(['tenant_id', 'customer_code']);
        });

        Schema::create('customer_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('customer_id')->index();
            $table->string('document_type', 32)->index();
            $table->string('file_id');
            $table->string('file_name');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->uuid('uploaded_by')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
        });

        Schema::create('customer_timeline_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('customer_id')->index();
            $table->uuid('actor_id')->nullable()->index();
            $table->string('event_type', 64)->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->jsonb('metadata')->default('{}');
            $table->timestampsTz();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_timeline_events');
        Schema::dropIfExists('customer_documents');
        Schema::dropIfExists('customers');
    }
};
