"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/dashboard/Icon";
import {
  DashboardPeriod,
  DashboardSummary,
  getDashboardSummary,
} from "@/lib/dashboard-api";
import { DASHBOARD_REFRESH_EVENT } from "@/lib/dashboard-refresh";
import {
  DASHBOARD_PERIODS,
  dashboardPeriodLabel,
} from "@/lib/dashboard-periods";

const money = (value = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: Math.abs(value) >= 100000 ? "compact" : "standard",
  }).format(value);

const number = (value = 0) => value.toLocaleString("en-IN");

const primaryCards = [
  ["vehicles", "Active vehicles", "vehicle", "from-blue-500 to-indigo-600", "Vehicle portfolio"],
  ["active_policies", "Active policies", "shield", "from-emerald-500 to-teal-600", "Policies in force"],
  ["expiring_policies", "Expiring soon", "clock", "from-amber-400 to-orange-600", "Renewal attention"],
  ["renewal_count", "Renewals", "reports", "from-violet-500 to-fuchsia-600", "Completed in period"],
  ["payments_received", "Collections", "credit", "from-cyan-500 to-blue-600", "Money received"],
  ["outstanding_amount", "Outstanding", "wallet", "from-rose-500 to-orange-600", "Amount to collect"],
] as const;

const shortcuts = [
  ["New vehicle", "/vehicles/new", "vehicle", "Add RC & vehicle"],
  ["New customer", "/customers/new", "customers", "Create client"],
  ["Insurance", "/vehicles", "shield", "Add / renew policy"],
  ["RTO work", "/vehicles", "building", "Start process"],
  ["Payment", "/accounts", "credit", "Receive amount"],
  ["Expense", "/accounts", "wallet", "Book expense"],
  ["Masters", "/masters", "grid", "Manage setup"],
] as const;

export default function DashboardPage() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  const [data, setData] = useState<DashboardSummary>();
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const requestRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    if (period === "custom" && (!dateFrom || !dateTo || dateFrom > dateTo)) {
      setError("Select a valid inclusive custom date range.");
      return Promise.resolve();
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setRefreshing(true);
    setError("");

    return getDashboardSummary({ period, dateFrom, dateTo }, controller.signal)
      .then((summary) => {
        setData(summary);
        setLastUpdated(new Date());
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (e instanceof Error && e.message === "AUTH_REQUIRED") {
          sessionStorage.removeItem("raj_erp_token");
          location.replace("/login?next=/dashboard");
          return;
        }
        setError(e instanceof Error ? e.message : "Dashboard could not refresh.");
      })
      .finally(() => {
        if (requestRef.current === controller) {
          setRefreshing(false);
          requestRef.current = null;
        }
      });
  }, [period, dateFrom, dateTo]);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    const onVisible = () =>
      document.visibilityState === "visible" && void refresh();

    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    window.addEventListener(DASHBOARD_REFRESH_EVENT, onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      requestRef.current?.abort();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

  const selectedPeriodLabel = dashboardPeriodLabel(period);
  const activePolicies = data?.kpis.active_policies?.value ?? 0;
  const expiringPolicies = data?.kpis.expiring_policies?.value ?? 0;
  const portfolioHealth = useMemo(() => {
    if (!activePolicies) return 0;
    return Math.max(
      0,
      Math.min(100, Math.round(((activePolicies - expiringPolicies) / activePolicies) * 100)),
    );
  }, [activePolicies, expiringPolicies]);

  const trend = data?.revenue.trend ?? [];
  const trendMax = Math.max(1, ...trend.map((row) => Math.max(row.revenue, row.expenses)));
  const policyEntries = Object.entries(data?.policies ?? {}).sort((a, b) => b[1] - a[1]);
  const workEntries = Object.entries(data?.work ?? {}).sort((a, b) => b[1] - a[1]);
  const policyTotal = Math.max(1, policyEntries.reduce((sum, [, value]) => sum + value, 0));

  return (
    <main className="min-h-screen bg-[#f3f6fb] pb-10 dark:bg-[#050914]">
      <div className="mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6 lg:p-7">
        <section className="relative overflow-hidden rounded-[28px] border border-[#17367a]/30 bg-[#071632] text-white shadow-[0_30px_90px_-45px_rgba(2,20,70,.95)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_10%,rgba(37,99,235,.48),transparent_23%),radial-gradient(circle_at_92%_90%,rgba(14,165,233,.30),transparent_22%),linear-gradient(118deg,#071632_8%,#0a2353_55%,#103ba7_100%)]" />
          <div className="absolute inset-y-0 right-[31%] hidden w-px bg-white/10 xl:block" />
          <div className="relative grid gap-8 p-6 sm:p-8 xl:grid-cols-[1.4fr_.8fr] xl:items-stretch">
            <div className="flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-cyan-200">
                    Raj Insurance Control Room
                  </span>
                  <span className="text-xs font-semibold text-blue-100/65">{dateLabel}</span>
                </div>
                <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-[-.045em] sm:text-5xl">
                  Good to see you.
                  <span className="block text-blue-200">Here&apos;s the business pulse.</span>
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/70 sm:text-base">
                  Insurance, vehicles, renewals, collections and RTO operations — without digging through separate screens.
                </p>
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/vehicles/new" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#0b2355] shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5">
                  <Icon name="plus" className="h-4 w-4" /> New vehicle
                </Link>
                <Link href="/customers/new" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-black backdrop-blur transition hover:bg-white/15">
                  <Icon name="customers" className="h-4 w-4" /> New customer
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <HeroMetric label="Active policies" value={number(activePolicies)} icon="shield" />
              <HeroMetric label="Expiring soon" value={number(expiringPolicies)} icon="clock" tone="amber" />
              <HeroMetric label="Revenue" value={money(data?.revenue.current ?? 0)} icon="reports" />
              <HeroMetric label="Net result" value={money(data?.revenue.net_result ?? 0)} icon="rupee" tone="emerald" />
              <div className="col-span-2 rounded-2xl border border-white/10 bg-black/10 p-4 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-200/60">Portfolio health</p>
                    <p className="mt-1 text-2xl font-black">{portfolioHealth}%</p>
                  </div>
                  <div className="text-right text-xs text-blue-100/65">
                    <p>{refreshing ? "Refreshing live data…" : "Live & connected"}</p>
                    <p className="mt-1">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Waiting for first sync"}</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-300 to-emerald-300 transition-all" style={{ width: `${portfolioHealth}%` }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="min-w-40 px-1">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Reporting view</p>
              <p className="mt-1 text-base font-black text-slate-950 dark:text-white">{selectedPeriodLabel}</p>
            </div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Period
              <select value={period} onChange={(e) => setPeriod(e.target.value as DashboardPeriod)} className="mt-1 block min-w-48 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                {DASHBOARD_PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            {period === "custom" && (
              <>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">From<input type="date" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold normal-case text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">To<input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold normal-case text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
              </>
            )}
            <button type="button" disabled={refreshing} onClick={() => void refresh()} className="ml-auto rounded-xl bg-[#0c2555] px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-50">
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <Link href="/reports" className="hidden rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:text-white lg:block">
            Reports <span className="ml-2">→</span>
          </Link>
        </section>

        {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{error} <button onClick={() => void refresh()} className="ml-2 font-black underline">Retry</button></div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {primaryCards.map(([key, label, icon, tone, copy]) => {
            const metric = data?.kpis[key];
            const isMoney = key === "payments_received" || key === "outstanding_amount";
            return (
              <article key={key} className="group relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_16px_45px_-35px_rgba(15,23,42,.65)] transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <div className={`absolute -right-8 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${tone} opacity-[.10] blur-2xl transition group-hover:opacity-20`} />
                <div className="relative flex items-start justify-between gap-3">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-md`}><Icon name={icon} className="h-[18px] w-[18px]" /></span>
                  {metric?.growth !== null && metric?.growth !== undefined && (
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${metric.growth >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{metric.growth >= 0 ? "↗" : "↘"} {Math.abs(metric.growth)}%</span>
                  )}
                </div>
                <p className="relative mt-4 text-xs font-bold text-slate-500">{label}</p>
                <p className="relative mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{metric ? (isMoney ? money(metric.value) : number(metric.value)) : "—"}</p>
                <p className="relative mt-2 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">{copy}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.45fr_.8fr_.8fr]">
          <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Money movement</p>
                <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Revenue vs expenses</h2>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 dark:bg-slate-800">{selectedPeriodLabel}</div>
            </div>
            <div className="mt-6 flex h-56 items-end gap-3">
              {trend.length ? trend.map((row) => (
                <div key={row.month} className="flex h-full flex-1 flex-col justify-end">
                  <div className="flex h-[88%] items-end justify-center gap-1">
                    <div title={`Revenue ${money(row.revenue)}`} className="w-[42%] rounded-t-lg bg-gradient-to-t from-blue-700 to-cyan-400" style={{ height: `${Math.max(3, (row.revenue / trendMax) * 100)}%` }} />
                    <div title={`Expenses ${money(row.expenses)}`} className="w-[32%] rounded-t-lg bg-gradient-to-t from-rose-500 to-orange-300" style={{ height: `${Math.max(3, (row.expenses / trendMax) * 100)}%` }} />
                  </div>
                  <p className="mt-2 text-center text-[10px] font-bold text-slate-400">{row.month}</p>
                </div>
              )) : <EmptyState label="Revenue trend will appear here" />}
            </div>
            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4 dark:border-slate-800">
              <MiniMoney label="Revenue" value={data?.revenue.current} />
              <MiniMoney label="Gross profit" value={data?.revenue.gross_profit} />
              <MiniMoney label="Expenses" value={data?.revenue.expenses} />
              <MiniMoney label="Net result" value={data?.revenue.net_result} emphasis />
            </div>
          </article>

          <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Policy book</p>
            <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Policy status</h2>
            <div className="mt-6 space-y-4">
              {policyEntries.length ? policyEntries.slice(0, 6).map(([label, value], index) => {
                const width = Math.max(6, Math.round((value / policyTotal) * 100));
                const bars = ["bg-blue-600", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500", "bg-cyan-500"];
                return <div key={label}>
                  <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold capitalize text-slate-600 dark:text-slate-300">{label.replaceAll("_", " ")}</span><strong className="text-slate-950 dark:text-white">{number(value)}</strong></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${bars[index % bars.length]}`} style={{ width: `${width}%` }} /></div>
                </div>;
              }) : <EmptyState label="Policy status data will appear here" />}
            </div>
          </article>

          <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Operations</p>
            <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Work queue</h2>
            <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
              {workEntries.length ? workEntries.slice(0, 7).map(([label, value], index) => (
                <div key={label} className="flex items-center justify-between gap-3 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${index % 3 === 0 ? "bg-blue-50 text-blue-600" : index % 3 === 1 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}><Icon name={index % 2 ? "clock" : "building"} className="h-4 w-4" /></span>
                    <span className="truncate text-sm font-semibold capitalize text-slate-600 dark:text-slate-300">{label.replaceAll("_", " ")}</span>
                  </div>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">{number(value)}</span>
                </div>
              )) : <EmptyState label="No pending operational items" />}
            </div>
          </article>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
          <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Do it faster</p><h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Quick actions</h2></div>
              <span className="text-xs font-semibold text-slate-400">Most-used workflows</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {shortcuts.map(([label, href, icon, copy]) => (
                <Link key={label} href={href} className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-950/50">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-blue-600 shadow-sm transition group-hover:bg-blue-600 group-hover:text-white dark:bg-slate-900"><Icon name={icon} className="h-[18px] w-[18px]" /></span>
                  <p className="mt-4 text-sm font-black text-slate-900 dark:text-white">{label}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{copy}</p>
                </Link>
              ))}
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[24px] bg-[#0a1c42] p-6 text-white shadow-[0_24px_55px_-35px_rgba(2,20,70,.9)]">
            <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-blue-500/25 blur-3xl" />
            <div className="relative">
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-200">Finance snapshot</p>
              <h2 className="mt-2 text-2xl font-black">Profitability at a glance</h2>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <DarkMetric label="Gross commission" value={money(data?.revenue.gross_commission ?? 0)} />
                <DarkMetric label="Company cost" value={money(data?.revenue.company_cost ?? 0)} />
                <DarkMetric label="Agent commission" value={money(data?.revenue.agent_commission ?? 0)} />
                <DarkMetric label="TDS / deductions" value={money(data?.revenue.tds ?? 0)} />
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-300/15 bg-emerald-300/10 p-4">
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/70">Net result</p><p className="mt-1 text-2xl font-black">{money(data?.revenue.net_result ?? 0)}</p></div>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-300/15 text-emerald-200"><Icon name="reports" className="h-5 w-5" /></span>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function HeroMetric({ label, value, icon, tone = "blue" }: { label: string; value: string; icon: string; tone?: "blue" | "amber" | "emerald" }) {
  const toneClass = tone === "amber" ? "bg-amber-300/15 text-amber-200" : tone === "emerald" ? "bg-emerald-300/15 text-emerald-200" : "bg-blue-300/15 text-blue-200";
  return <div className="rounded-2xl border border-white/10 bg-white/[.07] p-4 backdrop-blur"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-blue-100/55">{label}</p><p className="mt-2 text-xl font-black tracking-tight sm:text-2xl">{value}</p></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${toneClass}`}><Icon name={icon} className="h-4.5 w-4.5" /></span></div></div>;
}

function MiniMoney({ label, value = 0, emphasis = false }: { label: string; value?: number; emphasis?: boolean }) {
  return <div className={`rounded-xl p-3 ${emphasis ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-slate-50 dark:bg-slate-950/50"}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-1 text-base font-black ${emphasis ? "text-emerald-700 dark:text-emerald-300" : "text-slate-900 dark:text-white"}`}>{money(value)}</p></div>;
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[.06] p-3.5"><p className="text-[10px] font-bold uppercase tracking-wider text-blue-100/50">{label}</p><p className="mt-1.5 text-sm font-black sm:text-base">{value}</p></div>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center text-xs font-semibold text-slate-400 dark:border-slate-800 dark:bg-slate-950/40">{label}</div>;
}
