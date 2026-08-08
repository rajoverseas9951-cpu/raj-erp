<?php

namespace Tests\Unit;

use App\Features\Vehicles\Services\VehicleMasterResolver;
use PHPUnit\Framework\TestCase;

class VehicleMasterResolverTest extends TestCase
{
    public function test_common_rc_aliases_match_existing_master_names(): void
    {
        $resolver = new VehicleMasterResolver;

        $this->assertSame(
            $resolver->matchingName('manufacturers', 'HERO MOTOCORP'),
            $resolver->matchingName('manufacturers', 'Hero MotoCorp Ltd.')
        );
        $this->assertSame(
            $resolver->matchingName('models', 'SPLENDOR PLUS'),
            $resolver->matchingName('models', 'SPLENDOR+')
        );
        $this->assertSame(
            $resolver->matchingName('vehicle_types', 'TWO WHEELER'),
            $resolver->matchingName('vehicle_types', 'two_wheeler')
        );
        $this->assertSame(
            $resolver->matchingName('fuel_types', 'PETROL+CNG'),
            $resolver->matchingName('fuel_types', 'PETROL/CNG')
        );
        $this->assertSame(
            $resolver->matchingName('manufacturers', 'ESCORTS'),
            $resolver->matchingName('manufacturers', 'ESCORTS LTD')
        );
        $this->assertSame(
            $resolver->matchingName('models', 'FARMTRAC 45'),
            $resolver->matchingName('models', 'FARMTRAC45')
        );
        $this->assertSame(
            $resolver->matchingName('vehicle_types', 'TRACTOR'),
            $resolver->matchingName('vehicle_types', 'AGRICULTURAL TRACTOR')
        );
    }

    public function test_normalized_keys_are_tenant_and_parent_scoped(): void
    {
        $resolver = new VehicleMasterResolver;
        $first = $resolver->normalizedKey('tenant-a', 'models', 'SPLENDOR+', 'make-a');

        $this->assertSame(
            $first,
            $resolver->normalizedKey('tenant-a', 'models', 'SPLENDOR PLUS', 'make-a')
        );
        $this->assertNotSame(
            $first,
            $resolver->normalizedKey('tenant-b', 'models', 'SPLENDOR PLUS', 'make-a')
        );
        $this->assertNotSame(
            $first,
            $resolver->normalizedKey('tenant-a', 'models', 'SPLENDOR PLUS', 'make-b')
        );
    }

    public function test_ocr_master_candidates_reject_garbage_and_allow_real_values(): void
    {
        $resolver = new VehicleMasterResolver;

        foreach (['USED', 'USE', 'NEW', 'OLD', 'OWNER', 'INDIVIDUAL', 'PRIVATE'] as $garbage) {
            $this->assertFalse($resolver->isStructurallyValidOcrCandidate('fuel_types', $garbage));
        }
        foreach (['PETROL', 'DIESEL', 'CNG', 'LPG', 'ELECTRIC', 'HYBRID'] as $fuel) {
            $this->assertTrue($resolver->isStructurallyValidOcrCandidate('fuel_types', $fuel));
        }
        $this->assertTrue($resolver->isStructurallyValidOcrCandidate('manufacturers', 'ESCORTS LTD'));
        $this->assertTrue($resolver->isStructurallyValidOcrCandidate('models', 'FARMTRAC45'));
        $this->assertFalse($resolver->isStructurallyValidOcrCandidate('manufacturers', 'GJ08BB6056'));
    }
}
