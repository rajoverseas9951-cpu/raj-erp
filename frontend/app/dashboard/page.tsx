"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/dashboard/Icon";
import { DashboardPeriod, DashboardSummary, getDashboardSummary } from "@/lib/dashboard-api";
import { BRAND } from "@/config/brand";
import { DASHBOARD_REFRESH_EVENT } from "@/lib/dashboard-refresh";
import { DASHBOARD_PERIODS, dashboardPeriodLabel } from "@/lib/dashboard-periods";

const kpis = [
  ["customers", "Customers", "customers", false, "from-cyan-400 to-blue-600"],
  ["vehicles", "Active Vehicles", "vehicle", false, "from-blue-500 to-indigo-600"],
  ["active_policies", "Active Policies", "shield", false, "from-emerald-400 to-teal-600"],
  ["expiring_policies", "Expiring Soon", "clock", false, "from-amber-400 to-orange-600"],
  ["payments_received", "Payments Received", "rupee", true, "from-cyan-400 to-sky-600"],
  ["outstanding_amount", "Outstanding", "rupee", true, "from-orange-400 to-rose-600"],
  ["revenue", "Revenue", "reports", true, "from-blue-400 to-indigo-700"],
  ["gross_commission", "Gross Commission", "reports", true, "from-violet-400 to-purple-700"],
  ["company_cost", "Company Cost", "wallet", true, "from-fuchsia-400 to-purple-700"],
  ["gross_profit", "Gross Profit", "reports", true, "from-emerald-400 to-cyan-700"],
  ["expenses", "Expenses", "wallet", true, "from-rose-400 to-pink-700"],
  ["net_result", "Net Profit", "building", true, "from-sky-400 to-cyan-700"],
  ["agent_commission", "Agent Commission", "customers", true, "from-teal-400 to-emerald-700"],
  ["tds", "TDS / Deductions", "payments", true, "from-amber-400 to-orange-700"],
  ["renewal_count", "Renewals", "clock", false, "from-indigo-400 to-violet-700"],
] as const;

const quick = [
  ["Add Customer", "/customers/new", "customers", "New customer"],
  ["Add Vehicle", "/vehicles/new", "vehicle", "RC & vehicle"],
  ["Add Policy", "/vehicles", "shield", "Issue policy"],
  ["Add Payment", "/accounts", "credit", "Receive money"],
  ["RTO Work", "/vehicles", "building", "Start process"],
  ["Add Expense", "/accounts", "wallet", "Book expense"],
  ["Masters", "/masters", "grid", "Manage setup"],
] as const;

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: Math.abs(value) >= 100000 ? "compact" : "standard",
  }).format(value);

export default function DashboardPage() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
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
    const onVisible = () => document.visibilityState === "visible" && void refresh();
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

  const date = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const selectedPeriodLabel = dashboardPeriodLabel(period);
  const health = useMemo(() => {
    const active = data?.kpis.active_policies.value ?? 0;
    const expiring = data?.kpis.expiring_policies.value ?? 0;
    if (!active) return 0;
    return Math.max(0, Math.min(100, Math.round(((active - expiring) / active) * 100)));
  }, [data]);

  return (
    <main className="min-h-screen bg-[#f4f7fb] pb-10 dark:bg-[#050914]">
      <div className="mx-auto max-w-[1700px] space-y-5 p-4 sm:p-6 lg:p-8">
        <section className="relative overflow-hidden rounded-[30px] bg-[#07132f] text-white shadow-[0_24px_80px_-36px_rgba(2,20,70,.9)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_15%,rgba(37,99,235,.55),transparent_25%),radial-gradient(circle_at_92%_85%,rgba(6,182,212,.32),transparent_24%),linear-gradient(120deg,#07132f_15%,#0b1f4d_55%,#123da5_100%)]" />
          <div className="absolute inset-0 opacity-[.12] [background-image:linear-gradient(rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.18)_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="relative grid gap-8 p-6 sm:p-8 xl:grid-cols-[1.45fr_.55fr] xl:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[.18em] text-cyan-200">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5">Executive command center</span>
                <span className="text-blue-200/70">{date}</span>
              </div>
              <h1 className="mt-5 max-w-4xl text-3xl font-black leading-[.98] tracking-[-.05em] sm:text-5xl lg:text-6xl">
                Everything that matters,
                <span className="block bg-gradient-to-r from-white via-cyan-200 to-blue-300 bg-clip-text text-transparent">one clear view.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100/70 sm:text-base">
                Live insurance, renewal, revenue and operations intelligence for {BRAND.productName}.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/vehicles/new" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#0b1f4d] shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5">+ Add Vehicle</Link>
                <Link href="/customers/new" className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/15">+ Add Customer</Link>
              </div>
            </div>
            <div className="rounded-[24px] border border-white/12 bg-white/[.08] p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-200/70">Portfolio health</p><p className="mt-2 text-4xl font-black">{health}%</p></div>
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300"><Icon name="shield" className="h-7 w-7" /></div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: `${health}%` }} /></div>
              <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/10 pt-4">
                <div><p className="text-[11px] uppercase tracking-wider text-blue-200/60">Status</p><p className="mt-1 text-sm font-bold">{refreshing ? "Refreshing live data…" : "Live & connected"}</p></div>
                <div className="text-right"><p className="text-[11px] uppercase tracking-wider text-blue-200/60">Last update</p><p className="mt-1 text-sm font-bold">{lastUpdated ? lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap items-end gap-3 rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mr-2 min-w-44"><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Reporting period</p><p className="mt-1 text-lg font-black text-slate-950 dark:text-white">{selectedPeriodLabel}</p></div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Period<select value={period} onChange={(e) => setPeriod(e.target.value as DashboardPeriod)} className="mt-1 block min-w-52 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">{DASHBOARD_PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {period === "custom" && <><label className="text-[10px] font-black uppercase tracking-wider text-slate-400">From<input type="date" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold normal-case text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label><label className="text-[10px] font-black uppercase tracking-wider text-slate-400">To<input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold normal-case text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label></>}
          <button type="button" disabled={refreshing} onClick={() => void refresh()} className="ml-auto rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-600">{refreshing ? "Refreshing…" : "Refresh data"}</button>
        </section>

        <QuickActions />

        {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{error} <button onClick={() => void refresh()} className="ml-2 font-black underline">Retry</button></div>}

        <section>
          <div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Live business pulse</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">Key performance</h2></div><p className="hidden text-xs text-slate-400 sm:block">Updated in real time from your ERP</p></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.map(([key, label, icon, isMoney, tone]) => {
              const item = data?.kpis[key];
              return <article key={key} className="group relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_32px_-24px_rgba(15,23,42,.5)] transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <div className={`absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${tone} opacity-[.09] blur-2xl transition group-hover:opacity-20`} />
                <div className="relative flex items-start justify-between gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-md`}><Icon name={icon} className="h-4.5 w-4.5" /></span>{item?.growth !== null && item?.growth !== undefined && <span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.growth >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{item.growth >= 0 ? "↗" : "↘"} {Math.abs(item.growth)}%</span>}</div>
                <p className="relative mt-4 text-[10px] font-black uppercase tracking-[.12em] text-slate-400">{isMoney ? `${selectedPeriodLabel} · ${label}` : label}</p>
                <p className="relative mt-1.5 text-2xl font-black tracking-[-.03em] text-slate-950 dark:text-white">{item ? (isMoney ? money(item.value) : item.value.toLocaleString("en-IN")) : <span className="inline-block h-7 w-24 animate-pulse rounded bg-slate-100" />}</p>
              </article>;
            })}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.55fr_.75fr]">
          <Panel title="Financial performance" copy={`${selectedPeriodLabel} revenue, previous comparison and outstanding`}>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">{[[selectedPeriodLabel, data?.revenue.current], ["Previous", data?.revenue.previous], ["Outstanding", data?.revenue.outstanding]].map(([l, v]) => <div key={String(l)} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{l}</p><p className="mt-2 text-xl font-black text-slate-950 dark:text-white">{money(Number(v ?? 0))}</p></div>)}</div>
            {(data?.revenue.trend.length ?? 0) > 0 ? <Trend rows={data?.revenue.trend ?? []} /> : <Empty text="No accounting activity available for this period." />}
          </Panel>
          <Panel title="Renewal radar" copy="Policies requiring immediate attention">
            <div className="mt-5 space-y-4">{[["Next 7 days", "7"], ["Next 15 days", "15"], ["Next 30 days", "30"], ["Expired", "expired"], ["Renewed", "renewed"]].map(([label, key], i) => <Meter key={key} label={label} value={data?.renewals[key] ?? 0} tone={i === 3 ? "rose" : i === 4 ? "emerald" : "blue"} />)}</div>
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="Policy portfolio" copy="Current mix across saved policies"><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{Object.entries({ New: "new", Renewals: "renewals", Comprehensive: "comprehensive", "Third party": "third_party", "Two-wheeler": "two_wheeler", "Private car": "private_car", Commercial: "commercial" }).map(([label, key]) => <Mini key={key} label={label} value={data?.policies[key] ?? 0} />)}</div></Panel>
          <Panel title="Operations watchlist" copy="Compliance and payment follow-ups"><div className="mt-5 grid grid-cols-2 gap-3">{Object.entries({ "PUC due": "puc_due", "Fitness due": "fitness_due", "Permit due": "permit_due", "Payment follow-up": "payment_follow_up" }).map(([label, key]) => <Mini key={key} label={label} value={data?.work[key] ?? 0} />)}</div></Panel>
        </section>
      </div>
    </main>
  );
}

function QuickActions() {
  return <section><div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">One-click workspace</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">Quick actions</h2></div><Link href="/masters" className="text-xs font-black text-blue-600">View all →</Link></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">{quick.map(([label, href, icon, copy]) => <Link key={label} href={href} className="group rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0b1f4d] text-white transition group-hover:bg-blue-600"><Icon name={icon} className="h-4.5 w-4.5" /></span><p className="mt-4 text-sm font-black text-slate-950 dark:text-white">{label}</p><p className="mt-1 text-[11px] text-slate-400">{copy}</p></Link>)}</div></section>;
}

function Panel({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) {
  return <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_50px_-36px_rgba(15,23,42,.55)] dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-black tracking-tight text-slate-950 dark:text-white">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{copy}</p></div><span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,.12)]" /></div>{children}</article>;
}

function Mini({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-white hover:shadow-sm dark:border-slate-800 dark:bg-slate-950"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-xl font-black text-slate-950 dark:text-white">{value.toLocaleString("en-IN")}</p></div>;
}

function Meter({ label, value, tone }: { label: string; value: number; tone: string }) {
  const color = tone === "rose" ? "from-rose-500 to-orange-400" : tone === "emerald" ? "from-emerald-500 to-cyan-400" : "from-blue-600 to-cyan-400";
  return <div><div className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-600 dark:text-slate-300">{label}</span><strong className="text-slate-950 dark:text-white">{value}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${Math.min(100, value ? Math.max(8, value * 5) : 0)}%` }} /></div></div>;
}

function Trend({ rows }: { rows: { month: string; revenue: number }[] }) {
  const max = Math.max(1, ...rows.map((x) => x.revenue));
  return <div className="mt-6 flex h-48 items-end gap-2 sm:gap-3">{rows.map((row) => <div key={row.month} className="flex h-full flex-1 flex-col justify-end text-center"><div className="group relative flex h-full items-end"><div title={money(row.revenue)} className="w-full rounded-t-xl bg-gradient-to-t from-[#123da5] via-blue-500 to-cyan-300 transition group-hover:brightness-110" style={{ height: `${Math.max(4, (row.revenue / max) * 100)}%` }} /></div><span className="mt-2 text-[10px] font-bold text-slate-400">{row.month}</span></div>)}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-400 dark:border-slate-800 dark:bg-slate-950">{text}</div>;
}
