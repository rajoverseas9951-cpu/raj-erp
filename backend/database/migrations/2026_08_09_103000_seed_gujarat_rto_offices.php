<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('vehicle_masters') || ! Schema::hasTable('tenants')) {
            return;
        }

        $offices = [
            ['GJ-01', 'Ahmedabad (West)'], ['GJ-02', 'Mehsana'], ['GJ-03', 'Rajkot'],
            ['GJ-04', 'Bhavnagar'], ['GJ-05', 'Surat'], ['GJ-06', 'Vadodara'],
            ['GJ-07', 'Nadiad (Kheda)'], ['GJ-08', 'Palanpur (Banaskantha)'],
            ['GJ-09', 'Himmatnagar (Sabarkantha)'], ['GJ-10', 'Jamnagar'],
            ['GJ-11', 'Junagadh'], ['GJ-12', 'Bhuj (Kutch)'], ['GJ-13', 'Surendranagar'],
            ['GJ-14', 'Amreli'], ['GJ-15', 'Valsad'], ['GJ-16', 'Bharuch'],
            ['GJ-17', 'Godhra (Panchmahal)'], ['GJ-18', 'Gandhinagar'], ['GJ-19', 'Bardoli'],
            ['GJ-20', 'Dahod'], ['GJ-21', 'Navsari'], ['GJ-22', 'Rajpipla (Narmada)'],
            ['GJ-23', 'Anand'], ['GJ-24', 'Patan'], ['GJ-25', 'Porbandar'],
            ['GJ-26', 'Vyara (Tapi)'], ['GJ-27', 'Ahmedabad (East)'],
            ['GJ-28', 'Surat (Rural/West)'], ['GJ-29', 'Vadodara (Rural)'],
            ['GJ-30', 'Ahwa (Dang)'], ['GJ-31', 'Modasa (Aravalli)'],
            ['GJ-32', 'Veraval (Gir Somnath)'], ['GJ-33', 'Botad'],
            ['GJ-34', 'Chhota Udepur'], ['GJ-35', 'Lunawada (Mahisagar)'],
            ['GJ-36', 'Morbi'], ['GJ-37', 'Khambhaliya (Devbhoomi Dwarka)'],
            ['GJ-38', 'Bavla (Ahmedabad Rural)'],
        ];

        foreach (DB::table('tenants')->pluck('id') as $tenantId) {
            foreach ($offices as [$code, $name]) {
                $existing = DB::table('vehicle_masters')
                    ->where('tenant_id', $tenantId)
                    ->where('type', 'rto_offices')
                    ->where('code', $code)
                    ->whereNull('deleted_at')
                    ->first();

                if ($existing) {
                    DB::table('vehicle_masters')->where('id', $existing->id)->update([
                        'name' => $name,
                        'status' => 'active',
                        'updated_at' => now(),
                    ]);
                } else {
                    DB::table('vehicle_masters')->insert([
                        'id' => (string) Str::uuid(), 'tenant_id' => $tenantId,
                        'type' => 'rto_offices', 'name' => $name, 'code' => $code,
                        'parent_id' => null, 'status' => 'active', 'notes' => 'Gujarat RTO master',
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        // Seed data is intentionally preserved on rollback to avoid deleting user-edited master records.
    }
};
