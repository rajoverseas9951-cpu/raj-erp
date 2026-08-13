<?php

namespace App\Features\Vehicles\Controllers;

use App\Features\Vehicles\Models\Vehicle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RtoWorkRecordController
{
    public function destroy(Request $request, string $vehicle, string $record)
    {
        abort_unless($request->user()?->can('vehicle.delete'), 403);

        $model = Vehicle::where('tenant_id', (string) $request->user()?->tenant_id)->findOrFail($vehicle);
        $row = DB::table('vehicle_rto_processes')
            ->where('tenant_id', $model->tenant_id)
            ->where('vehicle_id', $model->id)
            ->where('id', $record)
            ->whereNull('deleted_at')
            ->first();

        abort_unless($row, 404);

        DB::transaction(function () use ($row, $model, $request) {
            foreach (array_filter([$row->invoice_voucher_id ?? null, $row->government_fee_voucher_id ?? null]) as $voucherId) {
                DB::table('accounting_voucher_entries')->where('voucher_id', $voucherId)->delete();
                DB::table('accounting_vouchers')
                    ->where('tenant_id', $model->tenant_id)
                    ->where('id', $voucherId)
                    ->update([
                        'status' => 'cancelled',
                        'deleted_at' => now(),
                        'updated_by' => $request->user()?->id,
                        'updated_at' => now(),
                    ]);
            }

            DB::table('vehicle_rto_processes')
                ->where('tenant_id', $model->tenant_id)
                ->where('vehicle_id', $model->id)
                ->where('id', $row->id)
                ->update([
                    'deleted_at' => now(),
                    'updated_by' => $request->user()?->id,
                    'updated_at' => now(),
                ]);

            DB::table('vehicle_timeline_events')->insert([
                'id' => (string) Str::uuid(),
                'tenant_id' => $model->tenant_id,
                'vehicle_id' => $model->id,
                'actor_id' => $request->user()?->id,
                'event_type' => 'vehicle.rto_process.deleted',
                'title' => 'RTO Process deleted',
                'description' => $row->reference_number ?? null,
                'metadata' => json_encode(['record_id' => $row->id]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return response()->json(['success' => true, 'data' => null]);
    }
}
