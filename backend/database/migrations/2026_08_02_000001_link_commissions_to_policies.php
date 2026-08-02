<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('insurance_commissions', function (Blueprint $table) {
            $table->uuid('policy_id')->nullable()->after('insurance_company_id');
            $table->unique(['tenant_id', 'policy_id']);
        });
    }

    public function down(): void
    {
        Schema::table('insurance_commissions', function (Blueprint $table) {
            $table->dropUnique(['tenant_id', 'policy_id']);
            $table->dropColumn('policy_id');
        });
    }
};
