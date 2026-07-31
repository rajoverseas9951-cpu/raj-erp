<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_insurances', function (Blueprint $table) {
            $table->uuid('policy_document_file_id')->nullable()->index();
            $table->boolean('has_od_cover')->default(true);
            $table->boolean('has_tp_cover')->default(true);
            $table->decimal('net_premium', 15, 2)->default(0);
            $table->decimal('tp_net_premium', 15, 2)->default(0);
            $table->boolean('commission_on_od')->default(false);
            $table->boolean('commission_on_tp')->default(false);
            $table->boolean('commission_on_net')->default(false);
            $table->boolean('commission_on_addon')->default(false);
            $table->decimal('od_commission_percent', 8, 3)->default(0);
            $table->decimal('tp_commission_percent', 8, 3)->default(0);
            $table->decimal('od_commission_amount', 15, 2)->default(0);
            $table->decimal('tp_commission_amount', 15, 2)->default(0);
            $table->string('long_term_tp_policy_number')->nullable();
            $table->date('long_term_tp_expiry')->nullable()->index();
            $table->foreign('policy_document_file_id')->references('id')->on('vehicle_documents')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('vehicle_insurances', function (Blueprint $table) {
            $table->dropForeign(['policy_document_file_id']);
            $table->dropColumn([
                'policy_document_file_id', 'has_od_cover', 'has_tp_cover', 'net_premium',
                'tp_net_premium', 'commission_on_od', 'commission_on_tp', 'commission_on_net',
                'commission_on_addon', 'od_commission_percent', 'tp_commission_percent',
                'od_commission_amount', 'tp_commission_amount', 'long_term_tp_policy_number',
                'long_term_tp_expiry',
            ]);
        });
    }
};
