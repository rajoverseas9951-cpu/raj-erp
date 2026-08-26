"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { requiredModulesForPath, requiredSubmodulesForPath } from "@/lib/erp-modules";
import { organizationApi, type OrganizationModule, type OrganizationSubmodule } from "@/lib/organization";

function hide(el: Element | null | undefined, key: string) {
  if (!(el instanceof HTMLElement)) return;
  el.style.display = "none";
  el.setAttribute("data-erp-module-hidden", key);
}

export function ModuleRuntimeGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const [modules, setModules] = useState<OrganizationModule[]>([]);
  const [submodules, setSubmodules] = useState<OrganizationSubmodule[]>([]);
  const [ready, setReady] = useState(false);

  const disabled = useMemo(() => new Set(modules.filter((m) => !m.allowed || !m.enabled).map((m) => m.key)), [modules]);
  const disabledSubmodules = useMemo(() => new Set(submodules.filter((m) => !m.allowed || !m.enabled).map((m) => m.key)), [submodules]);

  useEffect(() => {
    let active = true;
    const load = () => organizationApi.get().then((org) => {
      if (!active) return;
      setModules(org.modules || []);
      setSubmodules(org.submodules || []);
      setReady(true);
    }).catch(() => setReady(true));
    void load();
    const onChanged = () => void load();
    window.addEventListener("erp-modules-changed", onChanged);
    return () => { active = false; window.removeEventListener("erp-modules-changed", onChanged); };
  }, []);

  useEffect(() => {
    if (!ready || pathname.startsWith("/settings/modules") || pathname === "/dashboard") return;
    const blockedModule = requiredModulesForPath(pathname).find((moduleKey) => disabled.has(moduleKey));
    const blockedSubmodule = requiredSubmodulesForPath(pathname).find((moduleKey) => disabledSubmodules.has(moduleKey));
    const blocked = blockedModule || blockedSubmodule;
    if (blocked) router.replace(`/dashboard?module=disabled&key=${encodeURIComponent(blocked)}`);
  }, [disabled, disabledSubmodules, pathname, ready, router]);

  useEffect(() => {
    if (!ready) return;
    const apply = () => {
      document.querySelectorAll<HTMLElement>("[data-erp-module-hidden]").forEach((el) => {
        el.style.removeProperty("display");
        el.removeAttribute("data-erp-module-hidden");
      });

      document.querySelectorAll<HTMLAnchorElement>("nav a[href], aside a[href]").forEach((anchor) => {
        const href = anchor.getAttribute("href") || "";
        if (href === "/dashboard") return;
        const blockedModule = requiredModulesForPath(href).find((moduleKey) => disabled.has(moduleKey));
        const blockedSubmodule = requiredSubmodulesForPath(href).find((moduleKey) => disabledSubmodules.has(moduleKey));
        const blocked = blockedModule || blockedSubmodule;
        if (blocked) hide(anchor.closest("li") || anchor, blocked);
      });

      const labelByKey: Record<string, string[]> = {
        POLICIES: ["Insurance"],
        CLAIMS: ["Claims"],
        ACCOUNTING: ["Accounts"],
        REPORTS: ["Reports"],
        CUSTOMERS: ["Customers"],
        VEHICLES: ["Vehicles"],
        RTO: ["Driving Licence"],
        FLEET: ["Fleet"],
        INSURANCE_MOTOR: ["Motor Insurance", "Motor"],
        INSURANCE_HEALTH: ["Health Insurance", "Health"],
        INSURANCE_NON_MOTOR: ["Non-Motor Insurance", "Non-Motor"],
        INSURANCE_LIFE: ["Life Insurance", "Life"],
        RTO_PUC: ["PUC"],
        RTO_FITNESS: ["Fitness"],
        RTO_PERMIT: ["Permit"],
        RTO_TAX: ["Tax"],
        RTO_HSRP: ["HSRP"],
      };

      Object.entries(labelByKey).forEach(([key, labels]) => {
        if (!disabled.has(key) && !disabledSubmodules.has(key)) return;
        document.querySelectorAll<HTMLButtonElement>("nav button").forEach((button) => {
          if (labels.some((label) => button.textContent?.trim().startsWith(label))) hide(button.parentElement || button, key);
        });
      });

      if (pathname === "/dashboard") {
        document.querySelectorAll<HTMLAnchorElement>("main a[href]").forEach((anchor) => {
          const href = anchor.getAttribute("href") || "";
          const blockedModule = requiredModulesForPath(href).find((moduleKey) => disabled.has(moduleKey));
          const blockedSubmodule = requiredSubmodulesForPath(href).find((moduleKey) => disabledSubmodules.has(moduleKey));
          const blocked = blockedModule || blockedSubmodule;
          if (blocked) hide(anchor, blocked);
        });

        const exactDashboardLabels: Record<string, string[]> = {
          INSURANCE_MOTOR: ["Active policies", "Renewals due", "Motor policy"],
          RTO_PUC: ["PUC"],
          RTO_FITNESS: ["Fitness"],
          RTO_PERMIT: ["Permit"],
          RTO_TAX: ["Tax due", "Tax"],
          RTO_HSRP: ["HSRP"],
        };
        document.querySelectorAll<HTMLElement>("main p, main span, main h3, main h4").forEach((node) => {
          const text = node.textContent?.trim() || "";
          Object.entries(exactDashboardLabels).forEach(([key, labels]) => {
            if (!disabledSubmodules.has(key) || !labels.includes(text)) return;
            hide(node.closest("article") || node.closest("a") || node.closest("li") || node.parentElement, key);
          });
        });
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [disabled, disabledSubmodules, pathname, ready]);

  return null;
}
