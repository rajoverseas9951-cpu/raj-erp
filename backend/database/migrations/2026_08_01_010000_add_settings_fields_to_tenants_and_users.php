<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->text('address')->nullable();
            $table->string('city', 120)->nullable();
            $table->string('state', 120)->nullable();
            $table->string('pin_code', 10)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('gst_number', 32)->nullable();
            $table->string('logo_path')->nullable();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('phone', 20)->nullable();
            $table->string('profile_photo_path')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['phone', 'profile_photo_path']));
        Schema::table('tenants', fn (Blueprint $table) => $table->dropColumn(['address', 'city', 'state', 'pin_code', 'phone', 'gst_number', 'logo_path']));
    }
};
