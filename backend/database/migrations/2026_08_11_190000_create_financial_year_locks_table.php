<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('financial_year_locks')) return;
        Schema::create('financial_year_locks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->date('fy_start');
            $table->date('fy_end');
            $table->timestamp('locked_at')->nullable();
            $table->uuid('locked_by')->nullable();
            $table->timestamp('unlocked_at')->nullable();
            $table->uuid('unlocked_by')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id','fy_start','fy_end']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_year_locks');
    }
};
