<?php

namespace App\Features\Vehicles\Services;

use Illuminate\Validation\ValidationException;

final class InsuranceCalculationService
{
    public const OD_PREMIUM = 'OD_PREMIUM';
    public const NET_PREMIUM = 'NET_PREMIUM';
    public const MANUAL = 'MANUAL';

    public function calculate(array $input, ?string $vehicleType = null): array
    {
        $policyType = strtolower((string) ($input['insurance_type'] ?? 'comprehensive'));
        $normalizedVehicleType = strtolower(trim((string) $vehicleType));
        $hasOd = array_key_exists('has_od_cover', $input)
            ? filter_var($input['has_od_cover'], FILTER_VALIDATE_BOOLEAN)
            : $policyType !== 'third_party';
        $hasTp = array_key_exists('has_tp_cover', $input)
            ? filter_var($input['has_tp_cover'], FILTER_VALIDATE_BOOLEAN)
            : $policyType !== 'standalone_od';

        $odPremium = $hasOd ? $this->money($input['od_premium'] ?? 0) : 0.0;
        $tpPremium = $hasTp ? $this->money($input['tp_premium'] ?? 0) : 0.0;
        $addonPremium = $this->money($input['addon_premium'] ?? 0);
        $otherCharges = $this->money($input['other_charges'] ?? 0);
        $customerDiscount = $this->money($input['customer_discount'] ?? 0);
        $requestedGstPercent = $this->percent($input['gst_percent'] ?? 18);

        $netPremium = $this->money($odPremium + $tpPremium + $addonPremium);
        $gst = $this->gst(
            $normalizedVehicleType,
            $odPremium,
            $tpPremium,
            $addonPremium,
            $requestedGstPercent
        );
        $gstAmount = $gst['amount'];
        $grossPremium = $this->money($netPremium + $gstAmount + $otherCharges);
        $customerPay = $this->money($grossPremium - $customerDiscount);

        if ($customerPay < 0) {
            throw ValidationException::withMessages([
                'customer_discount' => ['Customer discount cannot exceed gross premium.'],
            ]);
        }

        $basis = $this->basis(
            $input['commission_basis'] ?? null,
            $policyType,
            $normalizedVehicleType
        );
        $commissionPercent = $this->percent(
            $input['commission_percent'] ?? $input['od_commission_percent'] ?? 0
        );
        $commissionBase = match ($basis) {
            self::OD_PREMIUM => $odPremium,
            self::NET_PREMIUM => $netPremium,
            self::MANUAL => $this->money($input['manual_commission_amount'] ?? $input['gross_commission'] ?? 0),
        };
        $grossCommission = $basis === self::MANUAL
            ? $commissionBase
            : $this->money($commissionBase * $commissionPercent / 100);

        return [
            'has_od_cover' => $hasOd,
            'has_tp_cover' => $hasTp,
            'od_premium' => $odPremium,
            'tp_premium' => $tpPremium,
            'addon_premium' => $addonPremium,
            'net_premium' => $netPremium,
            'gst_percent' => $requestedGstPercent,
            'gst_amount' => $gstAmount,
            'gst_mode' => $gst['mode'],
            'od_addon_gst_percent' => $gst['od_addon_rate'],
            'tp_gst_percent' => $gst['tp_rate'],
            'cgst_amount' => $gst['cgst'],
            'sgst_amount' => $gst['sgst'],
            'tp_gst_amount' => $gst['tp_gst'],
            'od_addon_gst_amount' => $gst['od_addon_gst'],
            'other_charges' => $otherCharges,
            'gross_premium' => $grossPremium,
            'customer_discount' => $customerDiscount,
            'customer_pay' => $customerPay,
            'commission_basis' => $basis,
            'commission_base' => $commissionBase,
            'commission_percent' => $commissionPercent,
            'gross_commission' => $grossCommission,
        ];
    }

    /**
     * LGV / goods-carriage GST rule is based on actual insurer GST invoices supplied to the business:
     * - Basic TP: 5% total GST = 2.5% CGST + 2.5% SGST.
     * - Everything other than Basic TP: 18% = 9% CGST + 9% SGST.
     *
     * In the existing ERP data model, tp_premium is treated as Basic TP for LGV and addon_premium
     * is the 18% non-OD bucket (tariff add-ons / PA / legal-liability amounts as applicable).
     * CGST and SGST are rounded independently before being added, matching insurer invoices.
     */
    private function gst(string $vehicleType, float $odPremium, float $tpPremium, float $addonPremium, float $requestedPercent): array
    {
        $goodsCarriage = in_array($vehicleType, ['lgv', 'lcv', 'hgv', 'goods_carrier', 'goods_carriage'], true);

        if ($goodsCarriage) {
            $tpRate = 5.0;
            $odAddonRate = 18.0;

            $tpCgst = $this->money($tpPremium * 2.5 / 100);
            $tpSgst = $this->money($tpPremium * 2.5 / 100);
            $otherTaxablePremium = $this->money($odPremium + $addonPremium);
            $otherCgst = $this->money($otherTaxablePremium * 9 / 100);
            $otherSgst = $this->money($otherTaxablePremium * 9 / 100);

            $tpGst = $this->money($tpCgst + $tpSgst);
            $odAddonGst = $this->money($otherCgst + $otherSgst);
            $cgst = $this->money($tpCgst + $otherCgst);
            $sgst = $this->money($tpSgst + $otherSgst);

            return [
                'amount' => $this->money($cgst + $sgst),
                'mode' => 'mixed_goods_carriage',
                'od_addon_rate' => $odAddonRate,
                'tp_rate' => $tpRate,
                'cgst' => $cgst,
                'sgst' => $sgst,
                'tp_gst' => $tpGst,
                'od_addon_gst' => $odAddonGst,
            ];
        }

        $taxablePremium = $this->money($odPremium + $tpPremium + $addonPremium);
        $amount = $this->money($taxablePremium * $requestedPercent / 100);

        return [
            'amount' => $amount,
            'mode' => 'single_rate',
            'od_addon_rate' => $requestedPercent,
            'tp_rate' => $requestedPercent,
            'cgst' => 0.0,
            'sgst' => 0.0,
            'tp_gst' => 0.0,
            'od_addon_gst' => $amount,
        ];
    }

    private function basis(mixed $requested, string $policyType, string $vehicleType): string
    {
        $normalized = strtoupper((string) $requested);
        if (in_array($normalized, [self::OD_PREMIUM, self::NET_PREMIUM, self::MANUAL], true)) {
            return $normalized;
        }

        if (in_array($vehicleType, ['private_car', 'two_wheeler'], true)) {
            return $policyType === 'comprehensive' ? self::OD_PREMIUM : self::NET_PREMIUM;
        }

        return self::NET_PREMIUM;
    }

    private function money(mixed $value): float
    {
        return round(max(0, (float) $value), 2);
    }

    private function percent(mixed $value): float
    {
        return round(min(100, max(0, (float) $value)), 2);
    }
}
