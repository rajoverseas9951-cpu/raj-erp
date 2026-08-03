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

    public function test_invalid_or_low_confidence_ocr_master_candidates_are_rejected(): void
    {
        $resolver = new VehicleMasterResolver;

        $this->assertFalse($resolver->isValidOcrCandidate('fuel_types', 'USED', 0.99));
        $this->assertFalse($resolver->isValidOcrCandidate('manufacturers', "Maker's Name", 0.99));
        $this->assertFalse($resolver->isValidOcrCandidate('colours', 'BLUE', 0.39));
        $this->assertTrue($resolver->isValidOcrCandidate('fuel_types', 'DIESEL', 0.90));
        $this->assertTrue($resolver->isValidOcrCandidate('manufacturers', 'ESCORTS LTD', 0.90));
    }
}
