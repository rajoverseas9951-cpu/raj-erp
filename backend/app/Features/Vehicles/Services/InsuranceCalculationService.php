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
        $gstPercent = $this->percent($input['gst_percent'] ?? 18);

        $netPremium = $this->money($odPremium + $tpPremium + $addonPremium);
        $gstAmount = $this->money($netPremium * $gstPercent / 100);
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
            strtolower((string) $vehicleType)
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
            'gst_percent' => $gstPercent,
            'gst_amount' => $gstAmount,
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
