<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bug_agent_reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->string('source', 30)->default('upload')->index();
            $table->string('title', 190);
            $table->text('description')->nullable();
            $table->text('page_url')->nullable();
            $table->string('screenshot_path')->nullable();
            $table->string('severity', 20)->default('unknown')->index();
            $table->string('category', 80)->nullable();
            $table->string('status', 30)->default('analyzing')->index();
            $table->decimal('confidence', 5, 2)->nullable();
            $table->text('diagnosis')->nullable();
            $table->text('root_cause')->nullable();
            $table->longText('suggested_fix')->nullable();
            $table->boolean('auto_fix_eligible')->default(false);
            $table->string('auto_fix_action', 80)->nullable();
            $table->string('ai_model', 80)->nullable();
            $table->json('raw_response')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamp('detected_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bug_agent_reports');
    }
};
