<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! Schema::hasTable('vehicle_insurances') || ! Schema::hasTable('accounting_vouchers')) return;

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION sync_insurance_company_payable()
RETURNS trigger AS $$
DECLARE
    company_ledger uuid;
    recoverable_ledger uuid;
    voucher_id uuid;
    amount_due numeric(14,2);
    ref_no text;
BEGIN
    ref_no := 'POLICY-PAYABLE:' || NEW.id::text;
    amount_due := ROUND(COALESCE(NEW.customer_pay,0)::numeric,2);

    SELECT ledger_id INTO company_ledger
      FROM insurance_companies
     WHERE tenant_id = NEW.tenant_id
       AND id = NEW.insurance_company_id
       AND deleted_at IS NULL
     LIMIT 1;

    SELECT id INTO voucher_id
      FROM accounting_vouchers
     WHERE tenant_id = NEW.tenant_id
       AND reference_number = ref_no
     LIMIT 1;

    IF NEW.deleted_at IS NOT NULL OR NEW.status = 'cancelled' OR amount_due <= 0 OR company_ledger IS NULL THEN
        IF voucher_id IS NOT NULL THEN
            UPDATE accounting_vouchers SET status='cancelled', updated_at=NOW() WHERE id=voucher_id;
        END IF;
        RETURN NEW;
    END IF;

    -- Old records that were already settled must not be recreated as payable during backfill.
    IF TG_OP = 'UPDATE' AND voucher_id IS NULL AND EXISTS (
        SELECT 1 FROM insurance_policy_settlements
         WHERE tenant_id=NEW.tenant_id AND policy_id=NEW.id AND deleted_at IS NULL
    ) THEN
        RETURN NEW;
    END IF;

    SELECT id INTO recoverable_ledger
      FROM ledgers
     WHERE tenant_id=NEW.tenant_id
       AND UPPER(ledger_name)='INSURANCE PREMIUM RECOVERABLE'
       AND deleted_at IS NULL
     LIMIT 1;

    IF recoverable_ledger IS NULL THEN
        recoverable_ledger := gen_random_uuid();
        INSERT INTO ledgers(id,tenant_id,customer_id,ledger_name,ledger_group,opening_balance,balance_type,credit_limit,credit_days,gst_applicable,status,created_by,updated_by,created_at,updated_at)
        VALUES(recoverable_ledger,NEW.tenant_id,NULL,'INSURANCE PREMIUM RECOVERABLE','Current Assets',0,'debit',0,0,false,'active',NEW.created_by,NEW.updated_by,NOW(),NOW());
    END IF;

    IF voucher_id IS NULL THEN
        voucher_id := gen_random_uuid();
        INSERT INTO accounting_vouchers(id,tenant_id,policy_id,voucher_number,voucher_type,voucher_date,reference_number,narration,total_debit,total_credit,status,created_by,updated_by,created_at,updated_at)
        VALUES(voucher_id,NEW.tenant_id,NEW.id,'INSP-'||LEFT(REPLACE(NEW.id::text,'-',''),16),'purchase',COALESCE(NEW.issue_date,CURRENT_DATE),ref_no,'Insurance policy premium payable recognised',amount_due,amount_due,'posted',NEW.created_by,NEW.updated_by,NOW(),NOW());
        INSERT INTO accounting_voucher_entries(id,tenant_id,voucher_id,ledger_id,entry_type,amount,description,created_at,updated_at)
        VALUES
          (gen_random_uuid(),NEW.tenant_id,voucher_id,recoverable_ledger,'debit',amount_due,'Insurance premium recoverable',NOW(),NOW()),
          (gen_random_uuid(),NEW.tenant_id,voucher_id,company_ledger,'credit',amount_due,'Insurance company payable',NOW(),NOW());
    ELSE
        UPDATE accounting_vouchers
           SET voucher_date=COALESCE(NEW.issue_date,CURRENT_DATE),total_debit=amount_due,total_credit=amount_due,status='posted',updated_by=NEW.updated_by,updated_at=NOW()
         WHERE id=voucher_id;
        UPDATE accounting_voucher_entries SET amount=amount_due,updated_at=NOW() WHERE tenant_id=NEW.tenant_id AND voucher_id=voucher_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_insurance_company_payable ON vehicle_insurances;
CREATE TRIGGER trg_sync_insurance_company_payable
AFTER INSERT OR UPDATE OF customer_pay, insurance_company_id, status, deleted_at, issue_date
ON vehicle_insurances
FOR EACH ROW EXECUTE FUNCTION sync_insurance_company_payable();
SQL);

        // Backfill unpaid policies already saved before this migration.
        DB::statement("UPDATE vehicle_insurances SET updated_at = updated_at WHERE deleted_at IS NULL AND status <> 'cancelled' AND customer_pay > 0");
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared('DROP TRIGGER IF EXISTS trg_sync_insurance_company_payable ON vehicle_insurances; DROP FUNCTION IF EXISTS sync_insurance_company_payable();');
        }
    }
};
