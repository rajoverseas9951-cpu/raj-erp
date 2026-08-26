"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ERP_MODULES } from "@/lib/erp-modules";
import { organizationApi, type Organization, type OrganizationModule } from "@/lib/organization";

export default function ModuleSettingsPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    organizationApi.get().then(setOrg).catch((e) => setMessage(e instanceof Error ? e.message : "Module settings could not load.")).finally(() => setLoading(false));
  }, []);

  const states = useMemo(() => new Map((org?.modules || []).map((module) => [module.key, module])), [org?.modules]);
  const categories = ["Core", "Insurance", "RTO", "Finance", "Distribution", "Integrations"] as const;

  async function toggle(module: OrganizationModule, next: boolean) {
    if (!module.allowed && next) return;
    setSaving(module.key); setMessage("");
    try {
      const updated = await organizationApi.updateModule(module.key, next);
      setOrg(updated);
      window.dispatchEvent(new CustomEvent("erp-modules-changed"));
      setMessage(`${module.key} ${next ? "enabled" : "disabled"}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Module setting could not save.");
    } finally { setSaving(null); }
  }

  if (loading) return <main className="p-6 text-sm text-slate-500">Loading ERP modules…</main>;

  return <main className="mx-auto max-w-6xl space-y-6 p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[.18em] text-blue-600">ERP Administration</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Modules</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">Turn ERP modules on or off for this ERP. Modules not included in the platform entitlement stay locked and cannot be enabled here.</p>
      </div>
      <Link href="/settings" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm">← Settings</Link>
    </div>

    {message ? <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">{message}</div> : null}

    {categories.map((category) => {
      const modules = ERP_MODULES.filter((module) => module.category === category);
      if (!modules.length) return null;
      return <section key={category} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950">
        <h2 className="text-sm font-black uppercase tracking-[.14em] text-slate-500">{category}</h2>
        <div className="mt-4 divide-y divide-slate-100 dark:divide-white/10">
          {modules.map((definition) => {
            const state = states.get(definition.key) || { key: definition.key, allowed: true, enabled: true };
            const busy = saving === definition.key;
            return <div key={definition.key} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-900 dark:text-white">{definition.name}</h3>
                  {!state.allowed ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-500">Not in plan</span> : state.enabled ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">On</span> : <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-black uppercase text-rose-700">Off</span>}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{definition.description}</p>
              </div>
              <button
                type="button"
                disabled={!state.allowed || busy}
                onClick={() => void toggle(state, !state.enabled)}
                className={`relative h-8 w-14 rounded-full transition ${state.enabled && state.allowed ? "bg-blue-600" : "bg-slate-300"} disabled:cursor-not-allowed disabled:opacity-50`}
                aria-label={`${state.enabled ? "Disable" : "Enable"} ${definition.name}`}
              >
                <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${state.enabled && state.allowed ? "left-7" : "left-1"}`} />
              </button>
            </div>;
          })}
        </div>
      </section>;
    })}
  </main>;
}
