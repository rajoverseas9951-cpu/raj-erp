<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_masters', function (Blueprint $table) {
            $table->string('normalized_name', 160)->nullable()->index();
            $table->char('normalized_key', 64)->nullable()->unique();
            $table->string('source', 20)->nullable()->index();
        });

        $seen = [];
        foreach (DB::table('vehicle_masters')->orderBy('id')->get() as $master) {
            $normalized = $this->normalize((string) $master->name);
            $key = hash('sha256', implode('|', [
                $master->tenant_id,
                $master->type,
                $master->parent_id ?: '',
                $normalized,
            ]));
            if ($master->deleted_at !== null) {
                $key = hash('sha256', $key.'|deleted|'.$master->id);
            }
            if (isset($seen[$key])) {
                $key = hash('sha256', $key.'|legacy|'.$master->id);
            }
            $seen[$key] = true;
            DB::table('vehicle_masters')->where('id', $master->id)->update([
                'normalized_name' => $normalized,
                'normalized_key' => $key,
            ]);
        }

        Schema::table('vehicles', function (Blueprint $table) {
            $table->uuid('rto_office_id')->nullable()->index();
            $table->uuid('vehicle_type_id')->nullable()->index();
            $table->uuid('variant_id')->nullable()->index();
            $table->date('registration_valid_upto')->nullable();
            $table->unsignedTinyInteger('manufacturing_month')->nullable();
            $table->unsignedTinyInteger('number_of_cylinders')->nullable();
            $table->string('emission_norms', 80)->nullable();
            $table->decimal('horse_power', 10, 2)->nullable();
            $table->unsignedInteger('wheel_base')->nullable();
            $table->decimal('cubic_capacity', 10, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->unsignedInteger('cubic_capacity')->nullable()->change();
            $table->dropColumn([
                'rto_office_id',
                'vehicle_type_id',
                'variant_id',
                'registration_valid_upto',
                'manufacturing_month',
                'number_of_cylinders',
                'emission_norms',
                'horse_power',
                'wheel_base',
            ]);
        });

        Schema::table('vehicle_masters', function (Blueprint $table) {
            $table->dropUnique(['normalized_key']);
            $table->dropIndex(['normalized_name']);
            $table->dropIndex(['source']);
            $table->dropColumn(['normalized_name', 'normalized_key', 'source']);
        });
    }

    private function normalize(string $value): string
    {
        $value = Str::ascii(Str::upper(trim($value)));

        return (string) preg_replace('/[^A-Z0-9]+/', '', $value);
    }
};
