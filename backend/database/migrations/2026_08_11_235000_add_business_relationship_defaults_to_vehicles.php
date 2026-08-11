<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    private array $operationTables = [
        'vehicle_pucs','vehicle_fitnesses','vehicle_permits','vehicle_taxes','vehicle_counter_taxes',
        'vehicle_hsrp_records','vehicle_sld_records','vehicle_vltd_records','vehicle_rto_processes',
        'vehicle_transfer_processes','vehicle_payments','vehicle_agent_payments','vehicle_other_payments',
    ];

    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->string('business_source_type', 40)->default('direct')->index();
            $table->string('business_source_name', 160)->nullable();
            $table->string('default_payment_party_type', 40)->default('customer')->index();
            $table->uuid('default_payment_customer_id')->nullable()->index();
            $table->string('default_payment_party_name', 160)->nullable();
        });

        foreach ($this->operationTables as $tableName) {
            if (! Schema::hasTable($tableName)) continue;
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (! Schema::hasColumn($tableName, 'business_source_type')) $table->string('business_source_type', 40)->nullable()->index();
                if (! Schema::hasColumn($tableName, 'business_source_name')) $table->string('business_source_name', 160)->nullable();
                if (! Schema::hasColumn($tableName, 'payment_party_type')) $table->string('payment_party_type', 40)->nullable()->index();
                if (! Schema::hasColumn($tableName, 'payment_customer_id')) $table->uuid('payment_customer_id')->nullable()->index();
                if (! Schema::hasColumn($tableName, 'payment_party_name')) $table->string('payment_party_name', 160)->nullable();
            });
        }

        // PostgreSQL production: inherit defaults at DB level so every existing controller/service path stays accounting-consistent.
        // Explicit transaction values always win; only NULL values are filled from the vehicle.
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION raj_vehicle_relationship_defaults()
RETURNS trigger AS $$
DECLARE v record;
BEGIN
  SELECT business_source_type, business_source_name, default_payment_party_type,
         default_payment_customer_id, default_payment_party_name, customer_id, fleet_id
    INTO v FROM vehicles WHERE id = NEW.vehicle_id;
  IF FOUND THEN
    NEW.business_source_type := COALESCE(NEW.business_source_type, v.business_source_type, 'direct');
    NEW.business_source_name := COALESCE(NEW.business_source_name, v.business_source_name);
    NEW.payment_party_type := COALESCE(NEW.payment_party_type, v.default_payment_party_type, 'customer');
    IF NEW.payment_customer_id IS NULL AND NEW.payment_party_type = 'customer' THEN
      NEW.payment_customer_id := COALESCE(v.default_payment_customer_id, v.customer_id);
    END IF;
    NEW.payment_party_name := COALESCE(NEW.payment_party_name, v.default_payment_party_name,
      CASE WHEN NEW.payment_party_type = 'source' THEN v.business_source_name ELSE NULL END);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
SQL);
            foreach ($this->operationTables as $tableName) {
                if (! Schema::hasTable($tableName)) continue;
                DB::unprepared("DROP TRIGGER IF EXISTS raj_vehicle_relationship_defaults_trg ON {$tableName}; CREATE TRIGGER raj_vehicle_relationship_defaults_trg BEFORE INSERT ON {$tableName} FOR EACH ROW EXECUTE FUNCTION raj_vehicle_relationship_defaults();");
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            foreach ($this->operationTables as $tableName) {
                if (Schema::hasTable($tableName)) DB::unprepared("DROP TRIGGER IF EXISTS raj_vehicle_relationship_defaults_trg ON {$tableName};");
            }
            DB::unprepared('DROP FUNCTION IF EXISTS raj_vehicle_relationship_defaults();');
        }

        foreach ($this->operationTables as $tableName) {
            if (! Schema::hasTable($tableName)) continue;
            $drop = array_values(array_filter(['business_source_type','business_source_name','payment_party_type','payment_customer_id','payment_party_name'], fn ($column) => Schema::hasColumn($tableName, $column)));
            if ($drop) Schema::table($tableName, fn (Blueprint $table) => $table->dropColumn($drop));
        }

        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn(['business_source_type','business_source_name','default_payment_party_type','default_payment_customer_id','default_payment_party_name']);
        });
    }
};
