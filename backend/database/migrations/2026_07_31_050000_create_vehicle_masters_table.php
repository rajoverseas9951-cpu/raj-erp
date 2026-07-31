<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('vehicle_masters', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->string('type', 40)->index();
            $table->string('name', 160);
            $table->string('code', 40)->nullable();
            $table->uuid('parent_id')->nullable()->index();
            $table->string('status', 20)->default('active')->index();
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tenant_id', 'type', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_masters');
    }
};
