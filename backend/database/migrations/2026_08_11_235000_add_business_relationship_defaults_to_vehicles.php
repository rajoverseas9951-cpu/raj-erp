<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->string('business_source_type', 40)->default('direct')->index();
            $table->string('business_source_name', 160)->nullable();
            $table->string('default_payment_party_type', 40)->default('customer')->index();
            $table->uuid('default_payment_customer_id')->nullable()->index();
            $table->string('default_payment_party_name', 160)->nullable();
        });

        foreach ([
            'vehicle_pucs','vehicle_fitnesses','vehicle_permits','vehicle_taxes','vehicle_counter_taxes',
            'vehicle_hsrp_records','vehicle_sld_records','vehicle_vltd_records','vehicle_rto_processes',
            'vehicle_transfer_processes','vehicle_payments','vehicle_agent_payments','vehicle_other_payments',
        ] as $tableName) {
            if (! Schema::hasTable($tableName)) continue;
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (! Schema::hasColumn($tableName, 'business_source_type')) $table->string('business_source_type', 40)->nullable()->index();
                if (! Schema::hasColumn($tableName, 'business_source_name')) $table->string('business_source_name', 160)->nullable();
                if (! Schema::hasColumn($tableName, 'payment_party_type')) $table->string('payment_party_type', 40)->nullable()->index();
                if (! Schema::hasColumn($tableName, 'payment_customer_id')) $table->uuid('payment_customer_id')->nullable()->index();
                if (! Schema::hasColumn($tableName, 'payment_party_name')) $table->string('payment_party_name', 160)->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn(['business_source_type','business_source_name','default_payment_party_type','default_payment_customer_id','default_payment_party_name']);
        });

        foreach ([
            'vehicle_pucs','vehicle_fitnesses','vehicle_permits','vehicle_taxes','vehicle_counter_taxes',
            'vehicle_hsrp_records','vehicle_sld_records','vehicle_vltd_records','vehicle_rto_processes',
            'vehicle_transfer_processes','vehicle_payments','vehicle_agent_payments','vehicle_other_payments',
        ] as $tableName) {
            if (! Schema::hasTable($tableName)) continue;
            $drop = array_values(array_filter(['business_source_type','business_source_name','payment_party_type','payment_customer_id','payment_party_name'], fn ($column) => Schema::hasColumn($tableName, $column)));
            if ($drop) Schema::table($tableName, fn (Blueprint $table) => $table->dropColumn($drop));
        }
    }
};
