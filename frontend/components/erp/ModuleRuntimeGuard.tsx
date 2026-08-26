"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { moduleForPath } from "@/lib/erp-modules";
import { organizationApi, type OrganizationModule } from "@/lib/organization";

const reportDependencies: Array<[string, string]> = [
  ["/reports/profit-loss", "ACCOUNTING"],
  ["/reports/balance-sheet", "ACCOUNTING"],
  ["/reports/insurance-due", "ACCOUNTING"],
  ["/reports/expiry", "POLICIES"],
  ["/reports/insurance", "POLICIES"],
  ["/reports/insurance-commission", "POLICIES"],
  ["/reports/rto-work", "RTO"],
  ["/reports/rto-profit", "RTO"],
  ["/reports/hsrp", "RTO"],
];

function hide(el: Element | null | undefined, key: string) {
  if (!(el instanceof HTMLElement)) return;
  el.style.display = "none";
  el.setAttribute("data-erp-module-hidden", key);
}

function hideByExactText(root: ParentNode, selector: string, text: string, key: string, closest?: string) {
  const match = Array.from(root.querySelectorAll<HTMLElement>(selector)).find((el) => el.textContent?.trim() === text);
  if (!match) return null;
  const target = closest ? match.closest(closest) : match;
  hide(target, key);
  return target instanceof HTMLElement ? target : null;
}

export function ModuleRuntimeGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const [modules, setModules] = useState<OrganizationModule[]>([]);
  const [ready, setReady] = useState(false);

  const disabled = useMemo(() => new Set(modules.filter((m) => !m.enabled).map((m) => m.key)), [modules]);

  useEffect(() => {
    let active = true;
    const load = () => organizationApi.get().then((org) => {
      if (!active) return;
      setModules(org.modules || []);
      setReady(true);
    }).catch(() => setReady(true));
    void load();
    const onChanged = () => void load();
    window.addEventListener("erp-modules-changed", onChanged);
    return () => { active = false; window.removeEventListener("erp-modules-changed", onChanged); };
  }, []);

  useEffect(() => {
    if (!ready || pathname.startsWith("/settings/modules")) return;
    const moduleKey = moduleForPath(pathname);
    const dependentKey = reportDependencies.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1];
    if ((moduleKey && disabled.has(moduleKey)) || (dependentKey && disabled.has(dependentKey))) {
      router.replace("/dashboard?module=disabled");
    }
  }, [disabled, pathname, ready, router]);

  useEffect(() => {
    if (!ready) return;

    const apply = () => {
      document.querySelectorAll<HTMLElement>("[data-erp-module-hidden]").forEach((el) => {
        el.style.removeProperty("display");
        el.removeAttribute("data-erp-module-hidden");
      });
      document.querySelectorAll<HTMLElement>("[data-erp-module-layout]").forEach((el) => {
        el.style.removeProperty("grid-template-columns");
        el.removeAttribute("data-erp-module-layout");
      });

      document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
        const href = anchor.getAttribute("href") || "";
        const moduleKey = moduleForPath(href);
        const dependentKey = reportDependencies.find(([prefix]) => href === prefix || href.startsWith(`${prefix}/`))?.[1];
        const blockedKey = dependentKey && disabled.has(dependentKey)
          ? dependentKey
          : moduleKey && disabled.has(moduleKey)
            ? moduleKey
            : null;
        if (!blockedKey) return;
        hide(anchor.closest("li") || anchor, blockedKey);
      });

      const labelByKey: Record<string, string[]> = {
        POLICIES: ["Insurance"], CLAIMS: ["Claims"], ACCOUNTING: ["Accounts"], REPORTS: ["Reports"],
        CUSTOMERS: ["Customers"], VEHICLES: ["Vehicles"], RTO: ["Driving Licence"], FLEET: ["Fleet"],
      };
      Object.entries(labelByKey).forEach(([key, labels]) => {
        if (!disabled.has(key)) return;
        document.querySelectorAll<HTMLButtonElement>("nav button").forEach((button) => {
          if (!labels.some((label) => button.textContent?.trim().startsWith(label))) return;
          hide(button.parentElement || button, key);
        });
      });

      if (pathname !== "/dashboard") return;
      const main = document.querySelector("main");
      if (!main) return;

      if (disabled.has("ACCOUNTING")) {
        hideByExactText(main, "span", "Collection position", "ACCOUNTING");
        hideByExactText(main, "p", "Customer + ledger receivable live position", "ACCOUNTING", "div");
        hideByExactText(main, "p", "Payable", "ACCOUNTING", "div");
        hideByExactText(main, "p", "Commission", "ACCOUNTING", "div");
        hideByExactText(main, "p", "Company pending", "ACCOUNTING", "div");
        const financeAside = hideByExactText(main, "p", "Financial overview", "ACCOUNTING", "aside");
        if (financeAside?.parentElement instanceof HTMLElement) {
          financeAside.parentElement.style.gridTemplateColumns = "minmax(0,1fr)";
          financeAside.parentElement.setAttribute("data-erp-module-layout", "ACCOUNTING");
        }
        hideByExactText(main, "span", "Receive / Pay", "ACCOUNTING", "a");
        hideByExactText(main, "span", "Outstanding", "ACCOUNTING", "a");
        hideByExactText(main, "span", "Accounts", "ACCOUNTING", "a");
        const work = main.querySelector("#pending-work");
        if (work) {
          Array.from(work.querySelectorAll<HTMLAnchorElement>("a")).forEach((row) => {
            if (row.textContent?.toLowerCase().includes("payment follow up")) hide(row, "ACCOUNTING");
          });
        }
      }

      if (disabled.has("POLICIES")) {
        hideByExactText(main, "p", "Active policies", "POLICIES", "div");
        hideByExactText(main, "p", "Renewals due", "POLICIES", "div");
        hideByExactText(main, "p", "Company pending", "POLICIES", "div");
        hideByExactText(main, "span", "Motor policy", "POLICIES", "a");
        hideByExactText(main, "span", "Non-motor", "POLICIES", "a");
        hideByExactText(main, "span", "Health", "POLICIES", "a");
      }

      if (disabled.has("CUSTOMERS")) hideByExactText(main, "span", "New customer", "CUSTOMERS", "a");
      if (disabled.has("VEHICLES")) {
        hideByExactText(main, "p", "Vehicles", "VEHICLES", "div");
        hideByExactText(main, "span", "New vehicle", "VEHICLES", "a");
      }
      if (disabled.has("RTO")) {
        hideByExactText(main, "span", "RTO work", "RTO", "a");
        const work = main.querySelector("#pending-work");
        if (work) {
          Array.from(work.querySelectorAll<HTMLAnchorElement>("a")).forEach((row) => {
            const text = row.textContent?.toLowerCase() || "";
            if (text.includes("puc due") || text.includes("fitness due") || text.includes("permit due")) hide(row, "RTO");
          });
        }
      }

      const heroMetrics = Array.from(main.querySelectorAll<HTMLElement>("article p")).filter((p) =>
        ["Active policies", "Vehicles", "Renewals due", "Company pending"].includes(p.textContent?.trim() || ""),
      );
      const metricParents = heroMetrics.map((p) => p.parentElement).filter((el): el is HTMLElement => Boolean(el));
      const visibleMetrics = metricParents.filter((el) => el.style.display !== "none");
      const metricGrid = metricParents[0]?.parentElement;
      if (metricGrid instanceof HTMLElement && visibleMetrics.length > 0 && visibleMetrics.length < 4) {
        metricGrid.style.gridTemplateColumns = window.innerWidth >= 640
          ? `repeat(${visibleMetrics.length}, minmax(0, 1fr))`
          : "minmax(0,1fr)";
        metricGrid.setAttribute("data-erp-module-layout", "dashboard-metrics");
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [disabled, pathname, ready]);

  return null;
}
