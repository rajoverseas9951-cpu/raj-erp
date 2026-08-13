<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('vehicle_rto_processes') || ! Schema::hasColumn('vehicle_rto_processes', 'agent_amount')) {
            return;
        }

        Schema::table('vehicle_rto_processes', function (Blueprint $table) {
            // RTO agent is optional in the UI/backend. When agent is OFF the amount is intentionally NULL.
            $table->decimal('agent_amount', 12, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('vehicle_rto_processes') || ! Schema::hasColumn('vehicle_rto_processes', 'agent_amount')) {
            return;
        }

        // Preserve rollback safety for rows created while the agent was optional.
        \Illuminate\Support\Facades\DB::table('vehicle_rto_processes')->whereNull('agent_amount')->update(['agent_amount' => 0]);

        Schema::table('vehicle_rto_processes', function (Blueprint $table) {
            $table->decimal('agent_amount', 12, 2)->nullable(false)->change();
        });
    }
};
