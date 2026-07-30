<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->date('insurance_expiry')->nullable();
            $table->date('puc_expiry')->nullable();
            $table->date('fitness_expiry')->nullable();
            $table->date('permit_expiry')->nullable();
            $table->date('national_permit_expiry')->nullable();
            $table->date('tax_expiry')->nullable();
            $table->date('counter_tax_expiry')->nullable();
            $table->decimal('payment_due', 14, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn([
                'insurance_expiry','puc_expiry','fitness_expiry','permit_expiry',
                'national_permit_expiry','tax_expiry','counter_tax_expiry','payment_due'
            ]);
        });
    }
};
