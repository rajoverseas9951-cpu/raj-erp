<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            foreach (['manufacturer_id', 'model_id', 'colour_id', 'vehicle_class_id', 'vehicle_category_id', 'fuel_type_id'] as $column) {
                $table->uuid($column)->nullable()->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn(['manufacturer_id', 'model_id', 'colour_id', 'vehicle_class_id', 'vehicle_category_id', 'fuel_type_id']);
        });
    }
};
