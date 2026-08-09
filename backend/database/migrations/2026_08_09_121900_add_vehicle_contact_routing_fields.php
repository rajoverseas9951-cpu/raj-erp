<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table): void {
            $table->boolean('broker_agent_enabled')->default(false);
            $table->string('broker_name', 200)->nullable();
            $table->string('agent_name', 200)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table): void {
            $table->dropColumn(['broker_agent_enabled', 'broker_name', 'agent_name']);
        });
    }
};
