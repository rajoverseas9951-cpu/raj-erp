export const ERP_MODULE_KEYS = ["CUSTOMERS","VEHICLES","POLICIES","RENEWALS","CLAIMS","RTO","ACCOUNTING","DOCUMENTS","REPORTS","AGENTS","DEALERS","FLEET","WHATSAPP","RC_API","PAYMENTS"] as const;
export type ErpModuleKey = (typeof ERP_MODULE_KEYS)[number];

const routeModules: Array<[string, ErpModuleKey]> = [["/customers","CUSTOMERS"],["/vehicles","VEHICLES"],["/policies","POLICIES"],["/insurance","POLICIES"],["/claims","CLAIMS"],["/accounts","ACCOUNTING"],["/reports","REPORTS"],["/fleets","FLEET"]];

export function moduleForPath(path: string): ErpModuleKey | undefined { return routeModules.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1]; }
export function isModuleEnabled(enabledModules: readonly string[], module?: ErpModuleKey): boolean { return !module || enabledModules.includes(module); }
export function filterModuleNavigation<T extends { href: string }>(items: readonly T[], enabledModules: readonly string[]): T[] { return items.filter((item) => isModuleEnabled(enabledModules, moduleForPath(item.href))); }
