<?php

namespace Tests\Unit;

use App\Features\Vehicles\Services\CommercialVehicleDetector;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class CommercialVehicleDetectorTest extends TestCase
{
    /** @return array<string, array{array<int, string>}> */
    public static function commercialDescriptions(): array
    {
        return [
            'goods type' => [['goods_transport']],
            'heavy class' => [['HEAVY GOODS VEHICLE']],
            'pickup category' => [['PICKUP TRUCK']],
            'bus class' => [['PASSENGER BUS']],
            'taxi type' => [['contract_carriage_taxi']],
        ];
    }

    #[DataProvider('commercialDescriptions')]
    public function test_detects_commercial_descriptions(array $values): void
    {
        $this->assertTrue(CommercialVehicleDetector::matches($values));
    }

    public function test_private_and_two_wheeler_descriptions_are_not_commercial(): void
    {
        $this->assertFalse(CommercialVehicleDetector::matches([
            'private_car', 'MOTOR CAR (LMV)', 'HATCHBACK',
        ]));
        $this->assertFalse(CommercialVehicleDetector::matches([
            'two_wheeler', 'M-CYCLE/SCOOTER (2WN)', 'SOLO WITH PILLION',
        ]));
    }
}
