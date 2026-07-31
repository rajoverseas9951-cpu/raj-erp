<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_insurances', function (Blueprint $table) {
            $table->decimal('gst_percent', 5, 2)->default(0);
            $table->decimal('gst_amount', 15, 2)->default(0);
            $table->decimal('other_charges', 15, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('vehicle_insurances', function (Blueprint $table) {
            $table->dropColumn(['gst_percent', 'gst_amount', 'other_charges']);
        });
    }
};
