"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { moduleForPath } from "@/lib/erp-modules";
import { organizationApi, type OrganizationModule } from "@/lib/organization";

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
    const module = moduleForPath(pathname);
    if (module && disabled.has(module)) router.replace("/dashboard?module=disabled");
  }, [disabled, pathname, ready, router]);

  useEffect(() => {
    if (!ready) return;
    const apply = () => {
      document.querySelectorAll<HTMLElement>("[data-erp-module-hidden]").forEach((el) => {
        el.style.removeProperty("display");
        el.removeAttribute("data-erp-module-hidden");
      });
      document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
        const href = anchor.getAttribute("href") || "";
        const module = moduleForPath(href);
        if (!module || !disabled.has(module)) return;
        const target = anchor.closest("li") || anchor;
        (target as HTMLElement).style.display = "none";
        (target as HTMLElement).setAttribute("data-erp-module-hidden", module);
      });
      const labelByKey: Record<string, string[]> = {
        POLICIES: ["Insurance"], CLAIMS: ["Claims"], ACCOUNTING: ["Accounts"], REPORTS: ["Reports"],
        CUSTOMERS: ["Customers"], VEHICLES: ["Vehicles"], RTO: ["Driving Licence"], FLEET: ["Fleet"],
      };
      Object.entries(labelByKey).forEach(([key, labels]) => {
        if (!disabled.has(key)) return;
        document.querySelectorAll<HTMLButtonElement>("nav button").forEach((button) => {
          if (!labels.some((label) => button.textContent?.trim().startsWith(label))) return;
          const target = button.parentElement || button;
          target.style.display = "none";
          target.setAttribute("data-erp-module-hidden", key);
        });
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [disabled, ready]);

  return null;
}
