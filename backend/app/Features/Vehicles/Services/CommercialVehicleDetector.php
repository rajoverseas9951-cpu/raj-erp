<?php

namespace App\Features\Vehicles\Services;

final class CommercialVehicleDetector
{
    private const PATTERN = '/\b(?:COMMERCIAL|GOODS?|TRANSPORT|HGV|LGV|MGV|HMV|TRUCK|LORRY|TRAILER|PICK\s*UP|PICKUP|BUS|TAXI|CAB|MAXI|PSV|PASSENGER|STAGE\s+CARRIAGE|CONTRACT\s+CARRIAGE)\b/i';

    /** @param iterable<mixed> $values */
    public static function matches(iterable $values): bool
    {
        $text = collect($values)
            ->filter(fn ($value) => is_scalar($value) && trim((string) $value) !== '')
            ->map(fn ($value) => str_replace('_', ' ', (string) $value))
            ->implode(' ');

        return preg_match(self::PATTERN, $text) === 1;
    }
}
