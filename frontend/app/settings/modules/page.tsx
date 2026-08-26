"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ERP_MODULES, ERP_SUBMODULES, moduleDefinition, submoduleDefinition } from "@/lib/erp-modules";
import { organizationApi, type Organization, type OrganizationModule, type OrganizationSubmodule } from "@/lib/organization";

const categories = ["Core", "Insurance", "RTO", "Finance", "Distribution", "Integrations"] as const;

type ModuleState = OrganizationModule | OrganizationSubmodule;

function moduleName(key: string) {
  return moduleDefinition(key)?.name || submoduleDefinition(key)?.name || key.replaceAll("_", " ");
}

export default function ModuleSettingsPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    organizationApi.get()
      .then(setOrg)
      .catch((e) => setMessage(e instanceof Error ? e.message : "Module settings could not load."))
      .finally(() => setLoading(false));
  }, []);

  const states = useMemo(() => new Map((org?.modules || []).map((module) => [module.key, module])), [org?.modules]);
  const subStates = useMemo(() => new Map((org?.submodules || []).map((module) => [module.key, module])), [org?.submodules]);
  const counts = useMemo(() => {
    const all: ModuleState[] = [...(org?.modules || []), ...(org?.submodules || [])];
    return {
      active: all.filter((m) => m.allowed && m.enabled).length,
      blocked: all.filter((m) => m.allowed && !m.enabled && (m.blocked_by?.length || 0) > 0).length,
      off: all.filter((m) => m.allowed && !m.enabled && !(m.blocked_by?.length || 0)).length,
      locked: all.filter((m) => !m.allowed).length,
    };
  }, [org?.modules, org?.submodules]);

  async function toggle(module: ModuleState, next: boolean) {
    if (!module.allowed && next) return;
    setSaving(module.key);
    setMessage("");
    try {
      const updated = await organizationApi.updateModule(module.key, next);
      setOrg(updated);
      window.dispatchEvent(new CustomEvent("erp-modules-changed"));
      setMessage(`${moduleName(module.key)} ${next ? "configured ON" : "turned OFF"}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Module setting could not save.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <main className="p-6 text-sm text-slate-500">Loading ERP modules…</main>;

  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[.18em] text-blue-600">ERP Administration</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Modules</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Control the ERP from parent module down to individual insurance and RTO services. Subscription entitlement stays above this layer; dependencies and role permissions remain enforced automatically.
        </p>
      </div>
      <Link href="/settings" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/[.05] dark:text-slate-200">← Settings</Link>
    </div>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatusCard label="Active" value={counts.active} note="Parent + child usable now" tone="emerald" />
      <StatusCard label="Blocked" value={counts.blocked} note="Waiting for parent module" tone="amber" />
      <StatusCard label="Off" value={counts.off} note="Disabled in this ERP" tone="rose" />
      <StatusCard label="Plan locked" value={counts.locked} note="Not included upstream" tone="slate" />
    </section>

    {message ? <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">{message}</div> : null}

    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
      <strong>Dependency rule:</strong> Renewals and Claims require Insurance; Payments require Accounts. Insurance and RTO child services inherit their parent. A child can stay configured ON while blocked, then becomes available automatically when its parent returns ON.
    </div>

    {categories.map((category) => {
      const modules = ERP_MODULES.filter((module) => module.category === category);
      if (!modules.length) return null;
      return <section key={category} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h2 className="text-sm font-black uppercase tracking-[.14em] text-slate-500">{category}</h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {modules.map((definition) => {
            const state = states.get(definition.key) || { key: definition.key, allowed: true, enabled: true, configured_enabled: true, depends_on: definition.dependsOn || [], blocked_by: [] };
            const children = ERP_SUBMODULES.filter((child) => child.parentKey === definition.key);
            return <div key={definition.key}>
              <ModuleRow definitionName={definition.name} description={definition.description} state={state} dependencies={(state.depends_on?.length ? state.depends_on : definition.dependsOn || []).map(moduleName)} saving={saving} onToggle={toggle} />
              {children.length ? <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/[.025] sm:px-7">
                <div className="mb-1 px-2 pt-2 text-[9px] font-black uppercase tracking-[.16em] text-slate-400">Child services</div>
                <div className="divide-y divide-slate-200/70 dark:divide-white/10">
                  {children.map((child) => {
                    const parentState = states.get(child.parentKey) || state;
                    const childState = subStates.get(child.key) || {
                      key: child.key,
                      parent_key: child.parentKey,
                      allowed: parentState.allowed,
                      enabled: parentState.enabled,
                      configured_enabled: true,
                      blocked_by: parentState.enabled ? [] : [child.parentKey],
                    };
                    return <ModuleRow key={child.key} compact definitionName={child.name} description={child.description} state={childState} dependencies={[moduleName(child.parentKey)]} saving={saving} onToggle={toggle} />;
                  })}
                </div>
              </div> : null}
            </div>;
          })}
        </div>
      </section>;
    })}
  </main>;
}

function ModuleRow({ definitionName, description, state, dependencies, saving, onToggle, compact = false }: {
  definitionName: string;
  description: string;
  state: ModuleState;
  dependencies: string[];
  saving: string | null;
  onToggle: (module: ModuleState, next: boolean) => Promise<void>;
  compact?: boolean;
}) {
  const configured = state.configured_enabled ?? state.enabled;
  const blocked = state.allowed && configured && !state.enabled && (state.blocked_by?.length || 0) > 0;
  const busy = saving === state.key;
  const blockedNames = (state.blocked_by || []).map(moduleName);

  return <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${compact ? "px-2 py-4 sm:pl-7" : "px-5 py-5"}`}>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={`${compact ? "text-sm" : "text-base"} font-black text-slate-900 dark:text-white`}>{definitionName}</h3>
        {!state.allowed ? <Badge tone="slate">Not in plan</Badge>
          : blocked ? <Badge tone="amber">Blocked</Badge>
            : state.enabled ? <Badge tone="emerald">On</Badge>
              : <Badge tone="rose">Off</Badge>}
        {dependencies.length ? <span className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-500 dark:border-white/10">Requires {dependencies.join(" + ")}</span> : null}
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      {blockedNames.length ? <p className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300">Blocked by {blockedNames.join(" + ")}. Its ON preference is preserved.</p> : null}
      {!state.allowed ? <p className="mt-2 text-xs font-semibold text-slate-400">This ERP subscription does not currently allow its parent entitlement.</p> : null}
    </div>
    <div className="flex shrink-0 items-center gap-3">
      {blocked && configured ? <span className="hidden text-[10px] font-bold uppercase tracking-[.12em] text-amber-600 sm:block">Configured ON</span> : null}
      <button type="button" disabled={!state.allowed || busy} onClick={() => void onToggle(state, !configured)} className={`relative h-8 w-14 rounded-full transition ${configured && state.allowed ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"} disabled:cursor-not-allowed disabled:opacity-50`} aria-label={`${configured ? "Disable" : "Enable"} ${definitionName}`} aria-pressed={configured && state.allowed}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${configured && state.allowed ? "left-7" : "left-1"}`} />
      </button>
    </div>
  </div>;
}

function Badge({ children, tone }: { children: ReactNode; tone: "slate" | "amber" | "emerald" | "rose" }) {
  const classes = tone === "amber" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
    : tone === "emerald" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
      : tone === "rose" ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${classes}`}>{children}</span>;
}

function StatusCard({ label, value, note, tone }: { label: string; value: number; note: string; tone: "emerald" | "amber" | "rose" | "slate" }) {
  const classes = tone === "emerald" ? "text-emerald-600"
    : tone === "amber" ? "text-amber-600"
      : tone === "rose" ? "text-rose-600"
        : "text-slate-500";
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[.04]">
    <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">{label}</p>
    <p className={`mt-1 text-3xl font-black tracking-tight ${classes}`}>{value}</p>
    <p className="mt-1 text-xs text-slate-500">{note}</p>
  </div>;
}
