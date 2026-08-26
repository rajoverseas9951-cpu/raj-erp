export const ERP_MODULE_KEYS = ["CUSTOMERS","VEHICLES","POLICIES","RENEWALS","CLAIMS","RTO","ACCOUNTING","DOCUMENTS","REPORTS","AGENTS","DEALERS","FLEET","WHATSAPP","RC_API","PAYMENTS"] as const;
export type ErpModuleKey = (typeof ERP_MODULE_KEYS)[number];

export type ErpModuleDefinition = {
  key: ErpModuleKey;
  name: string;
  description: string;
  category: "Core" | "Insurance" | "RTO" | "Finance" | "Distribution" | "Integrations";
  paths: string[];
  dependsOn?: ErpModuleKey[];
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

export function moduleDefinition(key: string): ErpModuleDefinition | undefined {
  return ERP_MODULES.find((module) => module.key === key);
}

export function moduleForPath(path: string): ErpModuleKey | undefined {
  return routeModules.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1];
}

export function dependenciesForPath(path: string): ErpModuleKey[] {
  return ERP_ROUTE_DEPENDENCIES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] || [];
}

export function requiredModulesForPath(path: string): ErpModuleKey[] {
  const required = [moduleForPath(path), ...dependenciesForPath(path)].filter((key): key is ErpModuleKey => Boolean(key));
  return Array.from(new Set(required));
}

export function isModuleEnabled(enabledModules: readonly string[], module?: ErpModuleKey): boolean {
  return !module || enabledModules.includes(module);
}

export function isPathEnabled(path: string, enabledModules: readonly string[]): boolean {
  return requiredModulesForPath(path).every((module) => enabledModules.includes(module));
}

export function filterModuleNavigation<T extends { href: string }>(items: readonly T[], enabledModules: readonly string[]): T[] {
  return items.filter((item) => isPathEnabled(item.href, enabledModules));
}
