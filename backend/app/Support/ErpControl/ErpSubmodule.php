<?php

namespace App\Support\ErpControl;

enum ErpSubmodule: string
{
    case INSURANCE_MOTOR = 'INSURANCE_MOTOR';
    case INSURANCE_HEALTH = 'INSURANCE_HEALTH';
    case INSURANCE_NON_MOTOR = 'INSURANCE_NON_MOTOR';
    case INSURANCE_LIFE = 'INSURANCE_LIFE';

    case RTO_PUC = 'RTO_PUC';
    case RTO_FITNESS = 'RTO_FITNESS';
    case RTO_PERMIT = 'RTO_PERMIT';
    case RTO_TAX = 'RTO_TAX';
    case RTO_HSRP = 'RTO_HSRP';

    public function parent(): ErpModule
    {
        return match ($this) {
            self::INSURANCE_MOTOR,
            self::INSURANCE_HEALTH,
            self::INSURANCE_NON_MOTOR,
            self::INSURANCE_LIFE => ErpModule::POLICIES,

            self::RTO_PUC,
            self::RTO_FITNESS,
            self::RTO_PERMIT,
            self::RTO_TAX,
            self::RTO_HSRP => ErpModule::RTO,
        };
    }

    public static function forInsuranceLine(string $line): ?self
    {
        return match (strtolower(trim($line))) {
            'motor' => self::INSURANCE_MOTOR,
            'health' => self::INSURANCE_HEALTH,
            'non_motor', 'non-motor' => self::INSURANCE_NON_MOTOR,
            'life' => self::INSURANCE_LIFE,
            default => null,
        };
    }

    public static function forVehicleOperation(string $module): ?self
    {
        return match (strtolower(trim($module))) {
            'puc' => self::RTO_PUC,
            'fitness' => self::RTO_FITNESS,
            'permit' => self::RTO_PERMIT,
            'tax', 'counter_tax' => self::RTO_TAX,
            'hsrp' => self::RTO_HSRP,
            default => null,
        };
    }
}
