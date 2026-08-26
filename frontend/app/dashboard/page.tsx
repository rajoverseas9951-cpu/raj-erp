"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/dashboard/Icon";
import { DashboardPeriod, DashboardSummary, getDashboardSummary } from "@/lib/dashboard-api";
import { DASHBOARD_REFRESH_EVENT } from "@/lib/dashboard-refresh";
import { DASHBOARD_PERIODS, dashboardPeriodLabel } from "@/lib/dashboard-periods";
import { authenticatedRequest } from "@/lib/api-client";
import { financeControlApi, OutstandingPayload } from "@/lib/finance-control";
import { organizationApi, type OrganizationModule } from "@/lib/organization";

const money = (v = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
const num = (v = 0) => Number(v || 0).toLocaleString("en-IN");

type PolicyRow = { id: string; vehicle_id: string; status: string; archived_at?: string | null; customer_pay: number; gross_premium: number };
type PolicyPage = { data: PolicyRow[] };
type SettlementInfo = { settlement: unknown | null };
type Action = readonly [string, string, string, string, string];

type Metric = { label: string; value: string; note: string; accent: "blue" | "cyan" | "amber" | "emerald" };

const quickActions: readonly Action[] = [
  ["Motor policy", "Issue / renew", "/insurance/motor", "shield", "from-blue-500 to-indigo-600"],
  ["New customer", "Create profile", "/customers/new", "customers", "from-violet-500 to-fuchsia-600"],
  ["New vehicle", "Add RC / vehicle", "/vehicles/new", "vehicle", "from-cyan-500 to-blue-600"],
  ["Receive / Pay", "Cash & bank", "/accounts/cash-bank", "credit", "from-emerald-500 to-teal-600"],
];

const dockTools: readonly Action[] = [
  ["Outstanding", "Receivable / payable", "/accounts/outstanding", "wallet", "from-cyan-500 to-blue-600"],
  ["Accounts", "Daily accounts", "/accounts", "book", "from-emerald-500 to-teal-600"],
  ["Non-motor", "Property & business", "/insurance/non_motor", "shield", "from-violet-500 to-fuchsia-600"],
  ["Health", "Health insurance", "/insurance/health", "shield", "from-rose-500 to-pink-600"],
  ["RTO work", "Vehicle services", "/vehicles", "building", "from-amber-500 to-orange-600"],
  ["Reports", "Business reports", "/reports", "reports", "from-blue-600 to-indigo-700"],
];

function indiaNowParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hour24 = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(date));
  const greeting = hour24 < 12 ? "Good morning" : hour24 < 17 ? "Good afternoon" : hour24 < 21 ? "Good evening" : "Good night";
  return { greeting, date: `${map.weekday}, ${map.day} ${map.month} ${map.year}`, time: `${map.hour}:${map.minute} ${map.dayPeriod}` };
}

function moduleForWorkLabel(label: string) {
  const text = label.toLowerCase().replaceAll("_", " ");
  if (/puc|fitness|permit|hsrp|rto|tax due/.test(text)) return "RTO";
  if (/claim/.test(text)) return "CLAIMS";
  if (/payment|account|collection|receivable|payable|commission|cash|bank/.test(text)) return "ACCOUNTING";
  if (/renewal|policy|insurance/.test(text)) return "POLICIES";
  if (/customer/.test(text)) return "CUSTOMERS";
  if (/vehicle/.test(text)) return "VEHICLES";
  return null;
}

function moduleForHref(href: string) {
  if (href.startsWith("/accounts")) return "ACCOUNTING";
  if (href.startsWith("/insurance")) return "POLICIES";
  if (href.startsWith("/customers")) return "CUSTOMERS";
  if (href.startsWith("/claims")) return "CLAIMS";
  if (href.startsWith("/reports")) return "REPORTS";
  if (href.includes("rto") || href.includes("puc") || href.includes("fitness") || href.includes("permit") || href.includes("hsrp")) return "RTO";
  if (href.startsWith("/vehicles")) return "VEHICLES";
  return null;
}

export default function DashboardPage() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const [data, setData] = useState<DashboardSummary>();
  const [balances, setBalances] = useState<OutstandingPayload | null>(null);
  const [clock, setClock] = useState(() => indiaNowParts(new Date()));
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [companyPending, setCompanyPending] = useState({ count: 0, amount: 0 });
  const [modules, setModules] = useState<OrganizationModule[]>([]);
  const [modulesReady, setModulesReady] = useState(false);
  const req = useRef<AbortController | null>(null);
  const companyRefreshAt = useRef(0);

  const enabled = useMemo(() => {
    if (!modulesReady || modules.length === 0) return new Set<string>();
    return new Set(modules.filter((m) => m.allowed && m.enabled).map((m) => m.key));
  }, [modules, modulesReady]);
  const on = useCallback((key: string) => !modulesReady || modules.length === 0 || enabled.has(key), [enabled, modules.length, modulesReady]);

  const loadModules = useCallback(async () => {
    try { const org = await organizationApi.get(); setModules(org.modules || []); }
    finally { setModulesReady(true); }
  }, []);

  const refreshCompanyPayments = useCallback(async (force = false) => {
    if (!on("POLICIES")) { setCompanyPending({ count: 0, amount: 0 }); return; }
    const now = Date.now();
    if (!force && now - companyRefreshAt.current < 60_000) return;
    companyRefreshAt.current = now;
    try {
      const page = await authenticatedRequest<PolicyPage>("/policies?per_page=100");
      const active = (page?.data ?? []).filter((p) => !p.archived_at && !["cancelled", "expired", "draft"].includes(String(p.status || "").toLowerCase()));
      const checks = await Promise.all(active.map(async (p) => {
        try { const settlement = await authenticatedRequest<SettlementInfo>(`/vehicles/${p.vehicle_id}/insurances/${p.id}/settlement`); return settlement.settlement ? null : p; }
        catch { return p; }
      }));
      const pending = checks.filter((p): p is PolicyRow => Boolean(p));
      setCompanyPending({ count: pending.length, amount: pending.reduce((sum, p) => sum + Number(p.customer_pay || p.gross_premium || 0), 0) });
    } catch { setCompanyPending({ count: 0, amount: 0 }); }
  }, [on]);

  const refreshBalances = useCallback(async () => {
    if (!on("ACCOUNTING")) { setBalances(null); return; }
    try { setBalances(await financeControlApi.outstanding()); }
    catch { setBalances(null); }
  }, [on]);

  const refresh = useCallback((forceCompany = false) => {
    if (period === "custom" && (!dateFrom || !dateTo || dateFrom > dateTo)) { setError("Select a valid date range."); return Promise.resolve(); }
    req.current?.abort();
    const controller = new AbortController(); req.current = controller; setRefreshing(true); setError("");
    void refreshCompanyPayments(forceCompany); void refreshBalances();
    return getDashboardSummary({ period, dateFrom, dateTo }, controller.signal)
      .then(setData)
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (e instanceof Error && e.message === "AUTH_REQUIRED") { sessionStorage.removeItem("raj_erp_token"); location.replace("/login?next=/dashboard"); return; }
        setError(e instanceof Error ? e.message : "Dashboard could not refresh.");
      })
      .finally(() => { if (req.current === controller) { setRefreshing(false); req.current = null; } });
  }, [dateFrom, dateTo, period, refreshBalances, refreshCompanyPayments]);

  useEffect(() => { void loadModules(); const changed = () => void loadModules(); window.addEventListener("erp-modules-changed", changed); return () => window.removeEventListener("erp-modules-changed", changed); }, [loadModules]);
  useEffect(() => { const timer = window.setInterval(() => setClock(indiaNowParts(new Date())), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!modulesReady) return;
    void refresh();
    const onFocus = () => void refresh(); const onDashboardRefresh = () => void refresh(true);
    window.addEventListener("focus", onFocus); window.addEventListener(DASHBOARD_REFRESH_EVENT, onDashboardRefresh);
    return () => { req.current?.abort(); window.removeEventListener("focus", onFocus); window.removeEventListener(DASHBOARD_REFRESH_EVENT, onDashboardRefresh); };
  }, [modulesReady, refresh]);

  const rawWork = Object.entries(data?.work ?? {}).filter(([, value]) => Number(value) > 0);
  const work = rawWork.filter(([label]) => { const key = moduleForWorkLabel(label); return !key || on(key); }).sort((a, b) => Number(b[1]) - Number(a[1]));
  const totalWork = work.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  const vehicles = data?.kpis.vehicles?.value ?? 0;
  const policies = data?.kpis.active_policies?.value ?? 0;
  const due = data?.kpis.expiring_policies?.value ?? 0;
  const customerReceivable = Number(balances?.summary.customer_receivable ?? data?.kpis.outstanding_amount?.value ?? data?.revenue.outstanding ?? 0);
  const otherReceivable = Number(balances?.summary.ledger_receivable ?? 0);
  const totalReceivable = Number(balances?.summary.total_receivable ?? customerReceivable + otherReceivable);
  const payable = Number(balances?.summary.party_payable ?? 0);
  const commissionDue = Number(balances?.summary.insurance_commission_due ?? 0);
  const serviceDue = Number(balances?.summary.service_customer_due ?? 0);

  const metrics = useMemo<Metric[]>(() => {
    const items: Metric[] = [];
    if (on("POLICIES")) items.push({ label: "Active policies", value: num(policies), note: "In force", accent: "blue" });
    if (on("VEHICLES")) items.push({ label: "Vehicles", value: num(vehicles), note: "Managed", accent: "cyan" });
    if (on("POLICIES")) items.push({ label: "Renewals due", value: num(due), note: "Follow-up", accent: "amber" });
    if (on("POLICIES") && on("ACCOUNTING")) items.push({ label: "Company pending", value: num(companyPending.count), note: money(companyPending.amount), accent: "emerald" });
    if (on("CLAIMS")) items.push({ label: "Claims pending", value: num(rawWork.filter(([l]) => /claim/i.test(l)).reduce((s, [,v]) => s + Number(v || 0), 0)), note: "Claim desk", accent: "amber" });
    return items.slice(0, 4);
  }, [companyPending.amount, companyPending.count, due, on, policies, rawWork, vehicles]);

  const activeQuickActions = quickActions.filter(([, , href]) => { const key = moduleForHref(href); return !key || on(key); });
  const activeDockTools = dockTools.filter(([, , href, , ]) => {
    if (href === "/vehicles" && !on("RTO")) return false;
    const key = moduleForHref(href); return !key || on(key);
  });
  const accountingOn = on("ACCOUNTING");

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7fc] pb-28 text-[#15233d] antialiased dark:bg-[#070b13] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -left-44 -top-56 h-[520px] w-[520px] rounded-full bg-blue-200/30 blur-[120px] dark:bg-blue-500/10" /><div className="absolute -right-48 top-10 h-[520px] w-[520px] rounded-full bg-violet-200/30 blur-[120px] dark:bg-violet-500/10" /></div>
      <div className="relative mx-auto max-w-[1580px] px-4 pb-10 pt-3 sm:px-6 lg:px-8 lg:pt-4">
        <header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3"><div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-gradient-to-br from-[#155dff] via-[#4e72ff] to-[#7c56ff] text-white shadow-[0_12px_28px_rgba(64,89,240,.28)]"><Icon name="dashboard" className="h-4.5 w-4.5" /></div><div><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h1 className="text-[24px] font-semibold leading-none tracking-[-.04em] text-[#102442] sm:text-[29px] dark:text-white">{clock.greeting}</h1><span className="hidden h-4 w-px bg-[#d9e0ea] sm:block dark:bg-white/10" /><p className="text-[10px] font-medium text-[#8e9bb0]">{clock.date} · {clock.time} IST</p></div><div className="mt-1 flex items-center gap-2 text-[8px] font-bold uppercase tracking-[.18em] text-[#8290a7]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Live business command center</div></div></div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white bg-white/80 p-1.5 shadow-[0_10px_26px_rgba(42,61,101,.06)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[.05]"><select value={period} onChange={(e) => setPeriod(e.target.value as DashboardPeriod)} className="h-9 min-w-36 rounded-xl border-0 bg-transparent px-3 text-[10px] font-semibold text-[#55647d] outline-none dark:text-slate-200">{DASHBOARD_PERIODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><button onClick={() => void refresh(true)} disabled={refreshing} className="h-9 rounded-xl px-3 text-[10px] font-semibold text-[#66758c] transition hover:bg-[#f4f7fb] disabled:opacity-50 dark:hover:bg-white/10">{refreshing ? "Refreshing…" : "Refresh"}</button>{on("REPORTS") && <Link href="/reports" className="flex h-9 items-center gap-1.5 rounded-xl bg-[#10264b] px-4 text-[10px] font-semibold text-white">Reports <Icon name="arrow" className="h-3 w-3" /></Link>}</div>
        </header>
        {period === "custom" && <div className="mb-3 grid gap-2 rounded-2xl border border-white bg-white/80 p-2.5 sm:grid-cols-[1fr_1fr_auto]"><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-xl border border-[#dde3ec] bg-white px-3 text-xs" /><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-xl border border-[#dde3ec] bg-white px-3 text-xs" /><button onClick={() => void refresh(true)} className="h-9 rounded-xl bg-[#1768ff] px-5 text-xs font-semibold text-white">Apply</button></div>}
        {error && <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

        <section className="grid items-stretch gap-4 xl:grid-cols-[1.58fr_.42fr]">
          <article className="relative min-h-[310px] overflow-hidden rounded-[30px] bg-[#07162f] text-white shadow-[0_30px_74px_-36px_rgba(15,45,110,.7)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_7%_9%,rgba(28,104,255,.60),transparent_29%),radial-gradient(circle_at_95%_8%,rgba(120,74,255,.45),transparent_31%),radial-gradient(circle_at_72%_105%,rgba(5,197,255,.22),transparent_34%)]" /><div className="absolute right-[-70px] top-[-90px] h-[320px] w-[320px] rounded-full border border-white/10" />
            <div className="relative flex h-full flex-col justify-between p-6 sm:p-8 lg:p-9">
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.08] px-3 py-1.5 text-[8px] font-bold uppercase tracking-[.16em] text-cyan-100"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />{accountingOn ? "Collection position" : "Business overview"}</span><span className="rounded-full bg-white/[.06] px-3 py-1.5 text-[8px] font-semibold text-white/55">{dashboardPeriodLabel(period)}</span></div>{accountingOn && <Link href="/accounts/outstanding" className="rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[8px] font-semibold text-cyan-100">Open outstanding →</Link>}</div>
              {accountingOn ? <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[50px] font-semibold leading-none tracking-[-.065em] sm:text-[66px] xl:text-[76px]">{money(totalReceivable)}</p><p className="mt-2 text-[10px] text-white/45">Customer + ledger receivable live position</p></div><div className="grid grid-cols-2 gap-2"><MiniPulse label="Payable" value={money(payable)} tone={payable > 0 ? "rose" : "emerald"} /><MiniPulse label="Commission" value={money(commissionDue)} tone="violet" /></div></div> : <div className="mt-6"><p className="max-w-xl text-[30px] font-semibold leading-tight tracking-[-.04em] sm:text-[40px]">Only the work you actually use.</p><p className="mt-2 max-w-2xl text-[10px] leading-5 text-white/45">Disabled modules are removed completely while active business KPIs automatically fill the available space.</p></div>}
              <div className={`mt-6 grid gap-px overflow-hidden rounded-[22px] border border-white/10 bg-white/10 ${metrics.length === 1 ? "sm:grid-cols-1" : metrics.length === 2 ? "sm:grid-cols-2" : metrics.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>{metrics.map((m) => <HeroMetric key={m.label} {...m} />)}</div>
            </div>
          </article>
          <aside className="overflow-hidden rounded-[30px] border border-white bg-white/88 shadow-[0_18px_48px_rgba(35,57,100,.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[.05]"><div className="border-b border-[#edf0f5] px-4 py-4 dark:border-white/10"><div className="flex items-center justify-between gap-3"><div><p className="text-[8px] font-bold uppercase tracking-[.16em] text-blue-500">Quick actions</p><h2 className="mt-1 text-[20px] font-semibold tracking-[-.03em] text-[#192d4c] dark:text-white">Start work</h2></div><span className="grid h-9 w-9 place-items-center rounded-[13px] bg-blue-50 text-blue-600 dark:bg-blue-500/10"><Icon name="arrow" className="h-4 w-4" /></span></div></div><div className={`grid gap-px bg-[#edf0f5] dark:bg-white/10 ${activeQuickActions.length <= 1 ? "grid-cols-1" : activeQuickActions.length === 3 ? "grid-cols-1 sm:grid-cols-3 xl:grid-cols-1" : "grid-cols-2"}`}>{activeQuickActions.map(([label, desc, href, icon, gradient]) => <QuickAction key={label} label={label} desc={desc} href={href} icon={icon} gradient={gradient} />)}</div></aside>
        </section>

        <section className={`mt-4 grid gap-4 ${accountingOn ? "xl:grid-cols-[1.38fr_.62fr]" : "grid-cols-1"}`}>
          <article id="pending-work" className="overflow-hidden rounded-[30px] border border-white bg-white/88 shadow-[0_18px_50px_rgba(34,56,98,.07)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[.05]"><div className="flex flex-col gap-3 border-b border-[#edf0f5] px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10"><div><div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[.16em] text-violet-500"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" />Priority work</div><h2 className="mt-1 text-[23px] font-semibold tracking-[-.035em] text-[#192d4c] dark:text-white">What needs attention now</h2></div><div className="flex items-center gap-3 rounded-2xl bg-violet-50 px-3 py-2 dark:bg-violet-500/10"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-violet-600 shadow-sm dark:bg-white/10"><Icon name="clock" className="h-3.5 w-3.5" /></span><div><p className="text-[20px] font-bold leading-none text-violet-700 dark:text-violet-300">{num(totalWork)}</p><p className="mt-1 text-[7px] font-bold uppercase tracking-[.12em] text-violet-400">open items</p></div></div></div><div className="px-4 py-2 sm:px-5">{work.length ? work.slice(0, 6).map(([label, value], index) => <Link key={label} href="/vehicles" className="group flex min-h-[64px] items-center gap-3 border-b border-[#eef2f7] px-1 py-3 last:border-b-0 dark:border-white/10"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] ${index % 3 === 0 ? "bg-amber-50 text-amber-600" : index % 3 === 1 ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}><Icon name={index % 2 === 0 ? "clock" : "building"} className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold capitalize text-[#243a5e] dark:text-white">{label.replaceAll("_", " ")}</span><span className="mt-0.5 flex items-center gap-1.5 text-[8px] text-[#98a4b6]"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Needs follow-up</span></span><span className="grid h-8 min-w-8 place-items-center rounded-xl bg-[#f4f6fa] px-2 text-[10px] font-bold text-[#445775] dark:bg-white/10 dark:text-white">{num(Number(value))}</span><Icon name="chevron" className="h-3.5 w-3.5 text-[#a5afbe]" /></Link>) : <div className="grid min-h-[190px] place-items-center text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Icon name="shield" className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-[#243a5e] dark:text-white">No pending work</p></div></div>}</div></article>
          {accountingOn && <aside className="self-start overflow-hidden rounded-[30px] bg-[#10294f] text-white shadow-[0_20px_48px_rgba(16,41,79,.22)]"><div className="relative px-5 py-5"><div className="relative flex items-start justify-between gap-3"><div><p className="text-[8px] font-bold uppercase tracking-[.16em] text-cyan-300">Financial overview</p><h2 className="mt-1 text-[21px] font-semibold tracking-[-.03em]">Money position</h2></div><span className="grid h-10 w-10 place-items-center rounded-[14px] bg-white/[.07] text-cyan-300"><Icon name="wallet" className="h-4.5 w-4.5" /></span></div><div className="relative mt-4 space-y-0"><FinanceRow label="Total receivable" value={money(totalReceivable)} tone="cyan" /><FinanceRow label="Customer due" value={money(customerReceivable)} tone="cyan" /><FinanceRow label="Payable" value={money(payable)} tone={payable > 0 ? "rose" : "emerald"} /><FinanceRow label="Commission due" value={money(commissionDue)} tone="violet" /><FinanceRow label="Company payments" value={money(companyPending.amount)} note={`${companyPending.count} pending`} tone={companyPending.count > 0 ? "amber" : "emerald"} /></div>{serviceDue > 0 && <Link href="/accounts/outstanding" className="relative mt-3 flex items-center justify-between rounded-xl bg-amber-400/10 px-3 py-2 text-[9px] font-semibold text-amber-200"><span>Service due</span><strong>{money(serviceDue)}</strong></Link>}<div className="relative mt-4 grid grid-cols-2 gap-2"><Link href="/accounts/outstanding" className="rounded-xl bg-white px-3 py-2.5 text-center text-[9px] font-semibold text-[#10294f]">Open outstanding</Link><Link href="/accounts/cash-bank" className="rounded-xl border border-white/10 bg-white/[.06] px-3 py-2.5 text-center text-[9px] font-semibold text-white">Receive / Pay</Link></div>{otherReceivable > 0 && <p className="relative mt-3 text-[7px] leading-4 text-white/35">Includes {money(otherReceivable)} in other ledger receivables.</p>}</div></aside>}
        </section>
      </div>
      {activeDockTools.length > 0 && <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 pointer-events-none lg:pl-[288px]"><div className="pointer-events-auto flex max-w-[980px] items-center gap-1 overflow-x-auto rounded-[22px] border border-white/80 bg-white/88 p-2 shadow-[0_20px_55px_rgba(30,55,105,.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#101726]/90 [scrollbar-width:none]">{activeDockTools.map(([label, desc, href, icon, gradient]) => <DockItem key={label} label={label} desc={desc} href={href} icon={icon} gradient={gradient} />)}</div></div>}
    </main>
  );
}

function HeroMetric({ label, value, note, accent }: Metric) { const color = accent === "amber" ? "text-amber-300" : accent === "emerald" ? "text-emerald-300" : accent === "cyan" ? "text-cyan-300" : "text-blue-300"; return <div className="bg-white/[.055] px-4 py-4 sm:px-5"><p className="text-[7px] font-bold uppercase tracking-[.14em] text-white/42">{label}</p><p className={`mt-2 text-[20px] font-bold tracking-[-.03em] ${color}`}>{value}</p><p className="mt-1 text-[7px] text-white/35">{note}</p></div>; }
function MiniPulse({ label, value, tone }: { label: string; value: string; tone: "rose" | "emerald" | "violet" }) { const color = tone === "rose" ? "text-rose-300" : tone === "emerald" ? "text-emerald-300" : "text-violet-300"; return <div className="min-w-[120px] rounded-[16px] border border-white/10 bg-white/[.06] px-3 py-2.5"><p className="text-[7px] font-bold uppercase tracking-[.13em] text-white/35">{label}</p><p className={`mt-1 text-[12px] font-bold ${color}`}>{value}</p></div>; }
function QuickAction({ label, desc, href, icon, gradient }: { label: string; desc: string; href: string; icon: string; gradient: string }) { return <Link href={href} className="group min-h-[118px] bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:bg-[#fafcff] dark:bg-[#0f1520]"><span className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${gradient} text-white`}><Icon name={icon} className="h-5 w-5" /></span><span className="mt-3 block text-[11px] font-semibold text-[#203653] dark:text-white">{label}</span><span className="mt-1 block text-[8px] text-[#98a4b6]">{desc}</span></Link>; }
function FinanceRow({ label, value, note, tone }: { label: string; value: string; note?: string; tone: "cyan" | "rose" | "emerald" | "violet" | "amber" }) { const color = tone === "rose" ? "text-rose-300" : tone === "emerald" ? "text-emerald-300" : tone === "violet" ? "text-violet-300" : tone === "amber" ? "text-amber-300" : "text-cyan-300"; return <div className="flex items-center justify-between gap-3 border-b border-white/10 py-3 last:border-b-0"><span><span className="block text-[8px] font-medium text-white/55">{label}</span>{note && <span className="mt-0.5 block text-[7px] text-white/30">{note}</span>}</span><strong className={`text-[11px] font-bold ${color}`}>{value}</strong></div>; }
function DockItem({ label, desc, href, icon, gradient }: { label: string; desc: string; href: string; icon: string; gradient: string }) { return <Link href={href} className="group flex min-w-[132px] items-center gap-2.5 rounded-[15px] px-3 py-2 transition hover:bg-[#f5f8fe] dark:hover:bg-white/[.06]"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br ${gradient} text-white`}><Icon name={icon} className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-[9px] font-semibold text-[#334b69] dark:text-white">{label}</span><span className="block truncate text-[7px] text-[#9aa6b7]">{desc}</span></span></Link>; }
