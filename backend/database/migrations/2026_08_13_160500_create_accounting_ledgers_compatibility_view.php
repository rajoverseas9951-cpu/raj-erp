<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // The canonical accounting ledger table in Raj ERP is `ledgers`.
        // Some RTO accounting code historically referenced `accounting_ledgers`.
        // On PostgreSQL, a simple single-table view is automatically updatable,
        // so SELECT/INSERT/UPDATE/DELETE continue to operate on the same ledger rows
        // without duplicating accounting data or changing IDs.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP VIEW IF EXISTS accounting_ledgers');
            DB::statement('CREATE VIEW accounting_ledgers AS SELECT * FROM ledgers');
            return;
        }

        // Non-PostgreSQL environments should use the canonical table directly;
        // no compatibility object is created because writable-view semantics vary.
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP VIEW IF EXISTS accounting_ledgers');
        }
    }
};
