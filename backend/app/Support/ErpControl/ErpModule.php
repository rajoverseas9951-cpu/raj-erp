<?php

namespace App\Support\ErpControl;

enum ErpModule: string
{
    case CUSTOMERS = 'CUSTOMERS';
    case VEHICLES = 'VEHICLES';
    case POLICIES = 'POLICIES';
    case RENEWALS = 'RENEWALS';
    case CLAIMS = 'CLAIMS';
    case RTO = 'RTO';
    case ACCOUNTING = 'ACCOUNTING';
    case DOCUMENTS = 'DOCUMENTS';
    case REPORTS = 'REPORTS';
    case AGENTS = 'AGENTS';
    case DEALERS = 'DEALERS';
    case FLEET = 'FLEET';
    case WHATSAPP = 'WHATSAPP';
    case RC_API = 'RC_API';
    case PAYMENTS = 'PAYMENTS';

    /**
     * Modules that must be effectively enabled before this module can run.
     * Preferences are intentionally kept separate: a child may remain configured
     * ON while its parent is OFF, then automatically becomes available again when
     * the parent is re-enabled.
     *
     * @return array<ErpModule>
     */
    public function dependencies(): array
    {
        return match ($this) {
            self::RENEWALS, self::CLAIMS => [self::POLICIES],
            self::PAYMENTS => [self::ACCOUNTING],
            default => [],
        };
    }
}
