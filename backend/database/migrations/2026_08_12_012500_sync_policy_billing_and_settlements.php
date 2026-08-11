<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('insurance_policy_settlements')) {
            Schema::create('insurance_policy_settlements', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('tenant_id')->index();
                $table->uuid('vehicle_id')->index();
                $table->uuid('policy_id')->index();
                $table->string('settlement_type', 40); // office_bank | direct_party
                $table->uuid('bank_ledger_id')->nullable()->index();
                $table->string('party_name')->nullable();
                $table->decimal('amount', 14, 2)->default(0);
                $table->date('payment_date');
                $table->string('reference_number')->nullable();
                $table->text('notes')->nullable();
                $table->uuid('created_by')->nullable();
                $table->timestampsTz();
                $table->softDeletesTz();
                $table->unique(['tenant_id', 'policy_id']);
            });
        }

        if (Schema::hasTable('vehicle_payments') && ! Schema::hasColumn('vehicle_payments', 'policy_id')) {
            Schema::table('vehicle_payments', function (Blueprint $table) {
                $table->uuid('policy_id')->nullable()->index();
            });
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION sync_vehicle_insurance_billing()
RETURNS trigger AS $$
DECLARE
    pay_id uuid;
    owner_name text;
BEGIN
    IF NEW.deleted_at IS NOT NULL OR NEW.status = 'cancelled' THEN
        UPDATE vehicle_payments
           SET deleted_at = NOW(), updated_at = NOW()
         WHERE tenant_id = NEW.tenant_id AND policy_id = NEW.id AND deleted_at IS NULL;
        RETURN NEW;
    END IF;

    SELECT TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,'')))
      INTO owner_name
      FROM vehicles v
      LEFT JOIN customers c ON c.id = v.customer_id AND c.tenant_id = v.tenant_id
     WHERE v.id = NEW.vehicle_id AND v.tenant_id = NEW.tenant_id;

    SELECT id INTO pay_id
      FROM vehicle_payments
     WHERE tenant_id = NEW.tenant_id AND policy_id = NEW.id
     ORDER BY created_at ASC LIMIT 1;

    IF pay_id IS NULL THEN
        INSERT INTO vehicle_payments (
            id, tenant_id, vehicle_id, policy_id, reference_number, issue_date,
            amount, party_amount, status, notes, metadata,
            payment_type, account, purpose, billed_amount, paid_amount, party_name,
            created_by, updated_by, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), NEW.tenant_id, NEW.vehicle_id, NEW.id,
            'INS-' || NEW.policy_number, NEW.issue_date,
            COALESCE(NEW.customer_pay,0), COALESCE(NEW.customer_pay,0),
            CASE WHEN COALESCE(NEW.customer_pay,0) > 0 THEN 'due' ELSE 'paid' END,
            'Auto-created from insurance policy', json_build_object('source','insurance_policy','policy_id',NEW.id),
            'insurance', NULL, 'Insurance Policy ' || NEW.policy_number,
            COALESCE(NEW.customer_pay,0), 0, NULLIF(owner_name,''),
            NEW.created_by, NEW.updated_by, NOW(), NOW()
        );
    ELSE
        UPDATE vehicle_payments
           SET reference_number = 'INS-' || NEW.policy_number,
               issue_date = NEW.issue_date,
               amount = COALESCE(NEW.customer_pay,0),
               party_amount = COALESCE(NEW.customer_pay,0),
               billed_amount = COALESCE(NEW.customer_pay,0),
               status = CASE
                   WHEN COALESCE(paid_amount,0) >= COALESCE(NEW.customer_pay,0) AND COALESCE(NEW.customer_pay,0) > 0 THEN 'paid'
                   WHEN COALESCE(paid_amount,0) > 0 THEN 'partial'
                   ELSE 'due' END,
               purpose = 'Insurance Policy ' || NEW.policy_number,
               party_name = COALESCE(NULLIF(party_name,''), NULLIF(owner_name,'')),
               deleted_at = NULL,
               updated_by = NEW.updated_by,
               updated_at = NOW()
         WHERE id = pay_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_vehicle_insurance_billing ON vehicle_insurances;
CREATE TRIGGER trg_sync_vehicle_insurance_billing
AFTER INSERT OR UPDATE OF customer_pay, policy_number, issue_date, status, deleted_at
ON vehicle_insurances
FOR EACH ROW EXECUTE FUNCTION sync_vehicle_insurance_billing();

INSERT INTO vehicle_payments (
    id, tenant_id, vehicle_id, policy_id, reference_number, issue_date,
    amount, party_amount, status, notes, metadata, payment_type, purpose,
    billed_amount, paid_amount, party_name, created_by, updated_by, created_at, updated_at
)
SELECT gen_random_uuid(), p.tenant_id, p.vehicle_id, p.id, 'INS-' || p.policy_number, p.issue_date,
       COALESCE(p.customer_pay,0), COALESCE(p.customer_pay,0),
       CASE WHEN COALESCE(p.customer_pay,0)>0 THEN 'due' ELSE 'paid' END,
       'Backfilled from insurance policy', json_build_object('source','insurance_policy','policy_id',p.id),
       'insurance', 'Insurance Policy ' || p.policy_number,
       COALESCE(p.customer_pay,0), 0,
       NULLIF(TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))),''),
       p.created_by, p.updated_by, NOW(), NOW()
  FROM vehicle_insurances p
  JOIN vehicles v ON v.id=p.vehicle_id AND v.tenant_id=p.tenant_id
  LEFT JOIN customers c ON c.id=v.customer_id AND c.tenant_id=v.tenant_id
 WHERE p.deleted_at IS NULL AND p.status <> 'cancelled'
   AND NOT EXISTS (
       SELECT 1 FROM vehicle_payments vp
        WHERE vp.tenant_id=p.tenant_id AND vp.policy_id=p.id
   );
SQL);
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared('DROP TRIGGER IF EXISTS trg_sync_vehicle_insurance_billing ON vehicle_insurances; DROP FUNCTION IF EXISTS sync_vehicle_insurance_billing();');
        }
        if (Schema::hasTable('vehicle_payments') && Schema::hasColumn('vehicle_payments', 'policy_id')) {
            Schema::table('vehicle_payments', fn (Blueprint $table) => $table->dropColumn('policy_id'));
        }
        Schema::dropIfExists('insurance_policy_settlements');
    }
};
