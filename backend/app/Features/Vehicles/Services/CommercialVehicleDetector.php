<?php

namespace App\Features\Vehicles\Services;

final class CommercialVehicleDetector
{
    private const PATTERN = '/\b(?:COMMERCIAL|GOODS?|TRANSPORT|HGV|HGVT|HGMV|HMV|LGV|LGVT|LCV|MGV|GT|TRUCK|LORRY|TIPPER|DUMPER|TRAILER|PICK\s*UP|PICKUP|BUS|OMNI\s*BUS|SCHOOL\s*BUS|AMBULANCE|TAXI|MOTOR\s*CAB|CAB|MAXI\s*CAB|MAXI|LPV|PSV|PASSENGER|STAGE\s*CARRIAGE|CONTRACT\s*CARRIAGE)\b/i';

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
