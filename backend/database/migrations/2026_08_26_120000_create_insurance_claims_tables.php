<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('insurance_claims', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('policy_id')->nullable()->index();
            $table->uuid('vehicle_id')->nullable()->index();
            $table->string('insurance_line', 40)->default('motor')->index();
            $table->string('business_channel', 20)->default('retail')->index();
            $table->string('policy_number')->nullable()->index();
            $table->string('insurance_company')->nullable();
            $table->string('customer_name')->nullable()->index();
            $table->string('customer_mobile', 30)->nullable();
            $table->string('registration_number', 40)->nullable()->index();
            $table->string('claim_type', 50)->default('own_damage');
            $table->string('claim_number')->nullable()->index();
            $table->date('loss_date')->nullable();
            $table->time('loss_time')->nullable();
            $table->string('loss_place')->nullable();
            $table->date('intimation_date')->nullable();
            $table->string('status', 40)->default('intimated')->index();
            $table->string('surveyor_name')->nullable();
            $table->string('surveyor_mobile', 30)->nullable();
            $table->string('garage_name')->nullable();
            $table->string('garage_mobile', 30)->nullable();
            $table->decimal('estimated_loss', 14, 2)->default(0);
            $table->decimal('approved_amount', 14, 2)->default(0);
            $table->decimal('deductible_amount', 14, 2)->default(0);
            $table->decimal('settlement_amount', 14, 2)->default(0);
            $table->timestamp('next_follow_up_at')->nullable()->index();
            $table->json('form_data')->nullable();
            $table->text('remarks')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'claim_number']);
        });

        Schema::create('insurance_claim_updates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('claim_id')->index();
            $table->string('status', 40)->nullable();
            $table->text('note');
            $table->timestamp('follow_up_at')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'claim_id']);
        });

        Schema::create('insurance_claim_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('claim_id')->index();
            $table->string('document_type', 80)->index();
            $table->string('label', 160);
            $table->string('status', 30)->default('pending')->index(); // pending, received, verified, rejected
            $table->boolean('is_required')->default(true);
            $table->string('file_path')->nullable();
            $table->string('file_name')->nullable();
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->text('remarks')->nullable();
            $table->uuid('uploaded_by')->nullable();
            $table->uuid('verified_by')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['tenant_id','claim_id','document_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('insurance_claim_documents');
        Schema::dropIfExists('insurance_claim_updates');
        Schema::dropIfExists('insurance_claims');
    }
};
