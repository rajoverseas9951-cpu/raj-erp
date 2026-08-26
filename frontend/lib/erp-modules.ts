export const ERP_MODULE_KEYS = ["CUSTOMERS","VEHICLES","POLICIES","RENEWALS","CLAIMS","RTO","ACCOUNTING","DOCUMENTS","REPORTS","AGENTS","DEALERS","FLEET","WHATSAPP","RC_API","PAYMENTS"] as const;
export type ErpModuleKey = (typeof ERP_MODULE_KEYS)[number];

export const ERP_SUBMODULE_KEYS = ["INSURANCE_MOTOR","INSURANCE_HEALTH","INSURANCE_NON_MOTOR","INSURANCE_LIFE","RTO_PUC","RTO_FITNESS","RTO_PERMIT","RTO_TAX","RTO_HSRP"] as const;
export type ErpSubmoduleKey = (typeof ERP_SUBMODULE_KEYS)[number];

export type ErpModuleDefinition = {
  key: ErpModuleKey;
  name: string;
  description: string;
  category: "Core" | "Insurance" | "RTO" | "Finance" | "Distribution" | "Integrations";
  paths: string[];
  dependsOn?: ErpModuleKey[];
};

export type ErpSubmoduleDefinition = {
  key: ErpSubmoduleKey;
  parentKey: ErpModuleKey;
  name: string;
  description: string;
  paths: string[];
};

export const ERP_MODULES: ErpModuleDefinition[] = [
  { key: "CUSTOMERS", name: "Customers", description: "Customer CRM, profiles and history.", category: "Core", paths: ["/customers"] },
  { key: "VEHICLES", name: "Vehicles", description: "Vehicle master, profiles and operations.", category: "Core", paths: ["/vehicles"] },
  { key: "POLICIES", name: "Insurance", description: "Motor, Health, Non-Motor and Life insurance workspace.", category: "Insurance", paths: ["/policies", "/insurance"] },
  { key: "RENEWALS", name: "Renewals", description: "Expiry and policy renewal workflow.", category: "Insurance", paths: ["/renewals"], dependsOn: ["POLICIES"] },
  { key: "CLAIMS", name: "Claims", description: "Claims desk, documents and insurer claim forms.", category: "Insurance", paths: ["/claims"], dependsOn: ["POLICIES"] },
  { key: "RTO", name: "RTO Services", description: "Driving licence and connected RTO service workflows.", category: "RTO", paths: ["/rto", "/services/driving-licence"] },
  { key: "ACCOUNTING", name: "Accounts", description: "Cash/bank, ledgers, outstanding and financial statements.", category: "Finance", paths: ["/accounts"] },
  { key: "PAYMENTS", name: "Payments", description: "Payment and settlement workflows.", category: "Finance", paths: ["/payments"], dependsOn: ["ACCOUNTING"] },
  { key: "REPORTS", name: "Reports", description: "Insurance, RTO, vehicle and business reports.", category: "Finance", paths: ["/reports"] },
  { key: "DOCUMENTS", name: "Documents", description: "Document storage and document workflows.", category: "Core", paths: ["/documents"] },
  { key: "AGENTS", name: "Agents", description: "Agent-facing workflows and reports.", category: "Distribution", paths: ["/agents"] },
  { key: "DEALERS", name: "Dealers", description: "Dealer-facing workflows and services.", category: "Distribution", paths: ["/dealers"] },
  { key: "FLEET", name: "Fleet", description: "Fleet operator records and workflows.", category: "Distribution", paths: ["/fleets"] },
  { key: "WHATSAPP", name: "WhatsApp", description: "WhatsApp communication tools.", category: "Integrations", paths: ["/whatsapp"] },
  { key: "RC_API", name: "RC / OCR API", description: "RC lookup, OCR and verification services.", category: "Integrations", paths: ["/rc-api"] },
];

export const ERP_SUBMODULES: ErpSubmoduleDefinition[] = [
  { key: "INSURANCE_MOTOR", parentKey: "POLICIES", name: "Motor Insurance", description: "Vehicle insurance issue, renewal and settlement workflows.", paths: ["/insurance/motor", "/policies"] },
  { key: "INSURANCE_HEALTH", parentKey: "POLICIES", name: "Health Insurance", description: "Retail, family and group health policy workflows.", paths: ["/insurance/health"] },
  { key: "INSURANCE_NON_MOTOR", parentKey: "POLICIES", name: "Non-Motor Insurance", description: "Property, fire, marine, liability and business covers.", paths: ["/insurance/non_motor", "/insurance/non-motor"] },
  { key: "INSURANCE_LIFE", parentKey: "POLICIES", name: "Life Insurance", description: "Life protection, savings and pension policy workflows.", paths: ["/insurance/life"] },
  { key: "RTO_PUC", parentKey: "RTO", name: "PUC", description: "Pollution certificate records and expiry workflow.", paths: ["/rto/puc", "/services/puc"] },
  { key: "RTO_FITNESS", parentKey: "RTO", name: "Fitness", description: "Vehicle fitness records and expiry workflow.", paths: ["/rto/fitness", "/services/fitness"] },
  { key: "RTO_PERMIT", parentKey: "RTO", name: "Permit", description: "Permit records and expiry workflow.", paths: ["/rto/permit", "/services/permit"] },
  { key: "RTO_TAX", parentKey: "RTO", name: "Tax", description: "Vehicle tax and counter-tax workflow.", paths: ["/rto/tax", "/services/tax"] },
  { key: "RTO_HSRP", parentKey: "RTO", name: "HSRP", description: "HSRP records, work queue and report workflow.", paths: ["/rto/hsrp", "/services/hsrp", "/reports/hsrp"] },
];

export const ERP_ROUTE_DEPENDENCIES: Array<[string, ErpModuleKey[]]> = [
  ["/reports/profit-loss", ["ACCOUNTING"]],
  ["/reports/balance-sheet", ["ACCOUNTING"]],
  ["/reports/insurance-due", ["POLICIES", "ACCOUNTING"]],
  ["/reports/insurance-commission", ["POLICIES", "ACCOUNTING"]],
  ["/reports/expiry", ["POLICIES"]],
  ["/reports/insurance", ["POLICIES"]],
  ["/reports/rto-work", ["RTO"]],
  ["/reports/rto-profit", ["RTO", "ACCOUNTING"]],
  ["/reports/hsrp", ["RTO"]],
];

const routeModules: Array<[string, ErpModuleKey]> = ERP_MODULES.flatMap((module) => module.paths.map((path) => [path, module.key] as [string, ErpModuleKey]));
const routeSubmodules: Array<[string, ErpSubmoduleKey]> = ERP_SUBMODULES.flatMap((module) => module.paths.map((path) => [path, module.key] as [string, ErpSubmoduleKey]));

export function moduleDefinition(key: string): ErpModuleDefinition | undefined {
  return ERP_MODULES.find((module) => module.key === key);
}

export function submoduleDefinition(key: string): ErpSubmoduleDefinition | undefined {
  return ERP_SUBMODULES.find((module) => module.key === key);
}

export function moduleForPath(path: string): ErpModuleKey | undefined {
  return routeModules.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1];
}

export function submoduleForPath(path: string): ErpSubmoduleKey | undefined {
  return routeSubmodules.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1];
}

export function dependenciesForPath(path: string): ErpModuleKey[] {
  return ERP_ROUTE_DEPENDENCIES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] || [];
}

export function requiredModulesForPath(path: string): ErpModuleKey[] {
  const required = [moduleForPath(path), ...dependenciesForPath(path)].filter((key): key is ErpModuleKey => Boolean(key));
  return Array.from(new Set(required));
}

export function requiredSubmodulesForPath(path: string): ErpSubmoduleKey[] {
  const required = [submoduleForPath(path)].filter((key): key is ErpSubmoduleKey => Boolean(key));
  return Array.from(new Set(required));
}

export function isModuleEnabled(enabledModules: readonly string[], module?: ErpModuleKey): boolean {
  return !module || enabledModules.includes(module);
}

export function isPathEnabled(path: string, enabledModules: readonly string[], enabledSubmodules: readonly string[] = []): boolean {
  return requiredModulesForPath(path).every((module) => enabledModules.includes(module))
    && requiredSubmodulesForPath(path).every((module) => enabledSubmodules.includes(module));
}

export function filterModuleNavigation<T extends { href: string }>(items: readonly T[], enabledModules: readonly string[], enabledSubmodules: readonly string[] = []): T[] {
  return items.filter((item) => isPathEnabled(item.href, enabledModules, enabledSubmodules));
}
