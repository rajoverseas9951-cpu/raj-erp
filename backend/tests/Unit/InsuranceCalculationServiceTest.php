<?php

namespace Tests\Unit;

use App\Features\Vehicles\Services\InsuranceCalculationService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class InsuranceCalculationServiceTest extends TestCase
{
    #[DataProvider('commissionCases')]
    public function test_motor_policy_commission_rules(
        string $vehicleType,
        string $policyType,
        string $expectedBasis,
        float $expectedBase,
        float $expectedCommission,
    ): void {
        $result = (new InsuranceCalculationService)->calculate([
            'insurance_type' => $policyType,
            'od_premium' => 10000,
            'tp_premium' => 3000,
            'addon_premium' => 2000,
            'other_charges' => 100,
            'customer_discount' => 700,
            'commission_percent' => 10,
        ], $vehicleType);

        $this->assertSame($expectedBasis, $result['commission_basis']);
        $this->assertSame($expectedBase, $result['commission_base']);
        $this->assertSame($expectedCommission, $result['gross_commission']);
    }

    public function test_premium_calculation_includes_gst_other_charges_and_discount(): void
    {
        $result = (new InsuranceCalculationService)->calculate([
            'insurance_type' => 'comprehensive',
            'od_premium' => 10000,
            'tp_premium' => 3000,
            'addon_premium' => 2000,
            'other_charges' => 100,
            'customer_discount' => 700,
        ], 'private_car');

        $this->assertSame(15000.0, $result['net_premium']);
        $this->assertSame(2700.0, $result['gst_amount']);
        $this->assertSame(17800.0, $result['gross_premium']);
        $this->assertSame(17100.0, $result['customer_pay']);
    }

    public function test_lgv_comprehensive_matches_real_sbi_general_invoice(): void
    {
        // SBI General policy POCMVGC0100969951:
        // Basic TP 16,049 @ 5%; all other premium 3,392.32 @ 18%.
        // Existing ERP stores OD separately and the remaining 18% bucket in addon_premium.
        $result = (new InsuranceCalculationService)->calculate([
            'insurance_type' => 'comprehensive',
            'od_premium' => 2917.32,
            'tp_premium' => 16049,
            'addon_premium' => 475,
            'other_charges' => 0,
        ], 'lgv');

        $this->assertSame('mixed_goods_carriage', $result['gst_mode']);
        $this->assertSame(5.0, $result['tp_gst_percent']);
        $this->assertSame(18.0, $result['od_addon_gst_percent']);
        $this->assertSame(19441.32, $result['net_premium']);
        $this->assertSame(802.46, $result['tp_gst_amount']);
        $this->assertSame(610.6, $result['od_addon_gst_amount']);
        $this->assertSame(706.53, $result['cgst_amount']);
        $this->assertSame(706.53, $result['sgst_amount']);
        $this->assertSame(1413.06, $result['gst_amount']);
        $this->assertSame(20854.38, $result['gross_premium']);
    }

    public function test_lgv_third_party_matches_real_sbi_general_invoice(): void
    {
        // SBI General policy POCMVGC0100967410:
        // Basic TP 16,049 @ 5%; PA/LL total 425 @ 18%.
        $result = (new InsuranceCalculationService)->calculate([
            'insurance_type' => 'third_party',
            'od_premium' => 0,
            'tp_premium' => 16049,
            'addon_premium' => 425,
            'other_charges' => 0,
        ], 'lgv');

        $this->assertSame(16474.0, $result['net_premium']);
        $this->assertSame(802.46, $result['tp_gst_amount']);
        $this->assertSame(76.5, $result['od_addon_gst_amount']);
        $this->assertSame(439.48, $result['cgst_amount']);
        $this->assertSame(439.48, $result['sgst_amount']);
        $this->assertSame(878.96, $result['gst_amount']);
        $this->assertSame(17352.96, $result['gross_premium']);
    }

    public static function commissionCases(): array
    {
        return [
            'private car comprehensive' => ['private_car', 'comprehensive', 'OD_PREMIUM', 10000, 1000],
            'private car standalone TP' => ['private_car', 'third_party', 'NET_PREMIUM', 5000, 500],
            'private car standalone OD' => ['private_car', 'standalone_od', 'NET_PREMIUM', 12000, 1200],
            'motorcycle comprehensive' => ['two_wheeler', 'comprehensive', 'OD_PREMIUM', 10000, 1000],
            'motorcycle standalone TP' => ['two_wheeler', 'third_party', 'NET_PREMIUM', 5000, 500],
            'motorcycle standalone OD' => ['two_wheeler', 'standalone_od', 'NET_PREMIUM', 12000, 1200],
        ];
    }

    public function test_manual_commission_uses_only_the_manual_amount(): void
    {
        $result = (new InsuranceCalculationService)->calculate([
            'insurance_type' => 'comprehensive',
            'od_premium' => 10000,
            'tp_premium' => 3000,
            'addon_premium' => 2000,
            'commission_basis' => 'MANUAL',
            'manual_commission_amount' => 777,
            'commission_percent' => 99,
        ], 'private_car');

        $this->assertSame(777.0, $result['commission_base']);
        $this->assertSame(777.0, $result['gross_commission']);
    }
}
