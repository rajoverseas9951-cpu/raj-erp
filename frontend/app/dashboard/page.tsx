"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/dashboard/Icon";
import { DashboardPeriod, DashboardSummary, getDashboardSummary } from "@/lib/dashboard-api";
import { DASHBOARD_REFRESH_EVENT } from "@/lib/dashboard-refresh";
import { DASHBOARD_PERIODS, dashboardPeriodLabel } from "@/lib/dashboard-periods";
import { authenticatedRequest } from "@/lib/api-client";
import { financeControlApi, OutstandingPayload } from "@/lib/finance-control";

const money = (v = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
const num = (v = 0) => v.toLocaleString("en-IN");

type PolicyRow = { id: string; vehicle_id: string; status: string; archived_at?: string | null; customer_pay: number; gross_premium: number };
type PolicyPage = { data: PolicyRow[] };
type SettlementInfo = { settlement: unknown | null };
type Tone = "blue" | "cyan" | "violet" | "emerald" | "amber" | "rose";
type ActionItem = readonly [string, string, string, string, Tone];

const primaryActions: readonly ActionItem[] = [
  ["Motor policy", "Issue or renew", "/insurance/motor", "shield", "blue"],
  ["New customer", "Create profile", "/customers/new", "customers", "violet"],
  ["New vehicle", "Add RC / vehicle", "/vehicles/new", "vehicle", "cyan"],
  ["Receive / Pay", "Cash & bank", "/accounts/cash-bank", "credit", "emerald"],
];

const secondaryActions: readonly ActionItem[] = [
  ["Non-motor", "Property & business", "/insurance/non_motor", "shield", "violet"],
  ["Health", "Health insurance", "/insurance/health", "shield", "rose"],
  ["RTO work", "Vehicle services", "/vehicles", "building", "amber"],
  ["Outstanding", "Receivable / payable", "/accounts/outstanding", "wallet", "cyan"],
  ["Accounts", "Daily accounts", "/accounts", "book", "emerald"],
  ["Reports", "P&L and analytics", "/reports", "reports", "blue"],
];

const toneStyles: Record<Tone, { dot: string; text: string; icon: string; wash: string; line: string }> = {
  blue: { dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-300", icon: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300", wash: "from-blue-500/18 to-indigo-500/5", line: "from-blue-500 to-indigo-500" },
  cyan: { dot: "bg-cyan-500", text: "text-cyan-700 dark:text-cyan-300", icon: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300", wash: "from-cyan-400/18 to-blue-500/5", line: "from-cyan-400 to-blue-500" },
  violet: { dot: "bg-violet-500", text: "text-violet-600 dark:text-violet-300", icon: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300", wash: "from-violet-500/18 to-fuchsia-500/5", line: "from-violet-500 to-fuchsia-500" },
  emerald: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", wash: "from-emerald-400/18 to-cyan-400/5", line: "from-emerald-400 to-cyan-500" },
  amber: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300", icon: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", wash: "from-amber-400/18 to-orange-400/5", line: "from-amber-400 to-orange-500" },
  rose: { dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-300", icon: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300", wash: "from-rose-400/18 to-orange-400/5", line: "from-rose-400 to-orange-500" },
};

function indiaNowParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hour24 = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(date));
  const greeting = hour24 < 12 ? "Good morning" : hour24 < 17 ? "Good afternoon" : hour24 < 21 ? "Good evening" : "Good night";
  return { greeting, date: `${map.weekday}, ${map.day} ${map.month} ${map.year}`, time: `${map.hour}:${map.minute} ${map.dayPeriod}` };
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
  const req = useRef<AbortController | null>(null);
  const companyRefreshAt = useRef(0);

  const refreshCompanyPayments = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - companyRefreshAt.current < 60_000) return;
    companyRefreshAt.current = now;
    try {
      const page = await authenticatedRequest<PolicyPage>("/policies?per_page=100");
      const active = (page?.data ?? []).filter((p) => !p.archived_at && !["cancelled", "expired", "draft"].includes(String(p.status || "").toLowerCase()));
      const checks = await Promise.all(active.map(async (p) => {
        try {
          const settlement = await authenticatedRequest<SettlementInfo>(`/vehicles/${p.vehicle_id}/insurances/${p.id}/settlement`);
          return settlement.settlement ? null : p;
        } catch { return p; }
      }));
      const pending = checks.filter((p): p is PolicyRow => Boolean(p));
      setCompanyPending({ count: pending.length, amount: pending.reduce((sum, p) => sum + Number(p.customer_pay || p.gross_premium || 0), 0) });
    } catch { setCompanyPending({ count: 0, amount: 0 }); }
  }, []);

  const refreshBalances = useCallback(async () => {
    try { setBalances(await financeControlApi.outstanding()); }
    catch { setBalances(null); }
  }, []);

  const refresh = useCallback((forceCompany = false) => {
    if (period === "custom" && (!dateFrom || !dateTo || dateFrom > dateTo)) {
      setError("Select a valid date range.");
      return Promise.resolve();
    }
    req.current?.abort();
    const controller = new AbortController();
    req.current = controller;
    setRefreshing(true);
    setError("");
    void refreshCompanyPayments(forceCompany);
    void refreshBalances();
    return getDashboardSummary({ period, dateFrom, dateTo }, controller.signal)
      .then(setData)
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
        if (req.current === controller) { setRefreshing(false); req.current = null; }
      });
  }, [period, dateFrom, dateTo, refreshCompanyPayments, refreshBalances]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(indiaNowParts(new Date())), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    const onDashboardRefresh = () => void refresh(true);
    window.addEventListener("focus", onFocus);
    window.addEventListener(DASHBOARD_REFRESH_EVENT, onDashboardRefresh);
    return () => {
      req.current?.abort();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, onDashboardRefresh);
    };
  }, [refresh]);

  const work = Object.entries(data?.work ?? {}).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  const totalWork = work.reduce((sum, [, value]) => sum + value, 0);
  const vehicles = data?.kpis.vehicles?.value ?? 0;
  const policies = data?.kpis.active_policies?.value ?? 0;
  const due = data?.kpis.expiring_policies?.value ?? 0;
  const customerReceivable = Number(balances?.summary.customer_receivable ?? data?.kpis.outstanding_amount?.value ?? data?.revenue.outstanding ?? 0);
  const otherReceivable = Number(balances?.summary.ledger_receivable ?? 0);
  const totalReceivable = Number(balances?.summary.total_receivable ?? customerReceivable + otherReceivable);
  const payable = Number(balances?.summary.party_payable ?? 0);
  const commissionDue = Number(balances?.summary.insurance_commission_due ?? 0);
  const serviceDue = Number(balances?.summary.service_customer_due ?? 0);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f1f5ff] pb-14 text-[#14284a] antialiased dark:bg-[#060914] dark:text-slate-100" style={{ fontFamily: '\"Segoe UI Variable\", \"Segoe UI\", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-52 -top-56 h-[620px] w-[620px] rounded-full bg-blue-300/20 blur-[110px] dark:bg-blue-500/10" />
        <div className="absolute -right-64 top-0 h-[640px] w-[640px] rounded-full bg-violet-300/18 blur-[120px] dark:bg-violet-500/10" />
        <div className="absolute bottom-[-320px] left-[26%] h-[620px] w-[620px] rounded-full bg-cyan-200/20 blur-[120px] dark:bg-cyan-500/10" />
      </div>

      <div className="relative mx-auto max-w-[1540px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-[17px] bg-gradient-to-br from-[#1768ff] via-[#4d75ff] to-[#8757ff] text-white shadow-[0_14px_30px_rgba(60,88,245,.28)]"><Icon name="dashboard" className="h-5 w-5" /></div>
            <div>
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,.9)]" /><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#8c9ab0]">Vimawallah live workspace</p></div>
              <h1 className="mt-1.5 text-[30px] font-[650] leading-none tracking-[-.045em] text-[#142748] sm:text-[36px] dark:text-white">{clock.greeting}</h1>
              <p className="mt-1.5 text-[10px] text-[#99a6ba]">{clock.date} · {clock.time} IST</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-[17px] border border-white/80 bg-white/72 p-1.5 shadow-[0_12px_34px_rgba(37,67,124,.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[.055]">
            <select value={period} onChange={(e) => setPeriod(e.target.value as DashboardPeriod)} className="h-9 min-w-40 rounded-xl border-0 bg-transparent px-3 text-[10px] font-semibold text-[#596b88] outline-none dark:text-slate-200" aria-label="Dashboard period">{DASHBOARD_PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <button onClick={() => void refresh(true)} disabled={refreshing} className="h-9 rounded-xl px-3.5 text-[10px] font-semibold text-[#71809a] transition hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10">{refreshing ? "Refreshing…" : "Refresh"}</button>
            <Link href="/reports" className="flex h-9 items-center gap-2 rounded-xl bg-[#14284e] px-4 text-[10px] font-semibold text-white shadow-[0_8px_20px_rgba(20,40,78,.18)] transition hover:-translate-y-0.5">Reports <Icon name="arrow" className="h-3 w-3" /></Link>
          </div>
        </header>

        {period === "custom" && <div className="mb-4 grid gap-2 rounded-[18px] border border-white/80 bg-white/75 p-3 backdrop-blur-xl sm:grid-cols-[1fr_1fr_auto] dark:border-white/10 dark:bg-white/[.05]"><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-xl border border-[#dce5f4] bg-white/85 px-3 text-xs outline-none dark:border-white/10 dark:bg-white/[.06]" /><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-xl border border-[#dce5f4] bg-white/85 px-3 text-xs outline-none dark:border-white/10 dark:bg-white/[.06]" /><button onClick={() => void refresh(true)} className="h-10 rounded-xl bg-gradient-to-r from-[#1768ff] to-[#7656ff] px-5 text-xs font-semibold text-white">Apply period</button></div>}
        {error && <div className="mb-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

        <section className="mb-4 grid gap-3 lg:grid-cols-12 lg:grid-rows-[220px_190px]">
          <article className="relative overflow-hidden rounded-[32px] bg-[#081733] text-white shadow-[0_30px_80px_-34px_rgba(16,48,125,.62)] lg:col-span-7 lg:row-span-2">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_6%_8%,rgba(21,105,255,.6),transparent_31%),radial-gradient(circle_at_96%_0%,rgba(124,72,255,.48),transparent_34%),radial-gradient(circle_at_72%_100%,rgba(0,220,255,.24),transparent_34%)]" />
            <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] [background-size:48px_48px]" />
            <div className="relative flex h-full min-h-[430px] flex-col justify-between p-6 sm:p-8">
              <div>
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5 text-[8px] font-bold uppercase tracking-[.17em] text-cyan-100">● Business pulse</span><span className="rounded-full bg-white/[.06] px-3 py-1.5 text-[8px] text-white/55">{dashboardPeriodLabel(period)}</span></div>
                <p className="mt-8 text-[9px] font-semibold uppercase tracking-[.2em] text-white/45">Total collection position</p>
                <p className="mt-2 text-[45px] font-[650] leading-none tracking-[-.06em] sm:text-[62px] xl:text-[72px]">{money(totalReceivable)}</p>
                <p className="mt-4 max-w-xl text-[11px] leading-5 text-blue-100/50 sm:text-[12px]">The number that matters most right now — plus the exact signals that need your attention next.</p>
              </div>

              <div>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <HeroSignal label="Renewals" value={num(due)} note={due > 0 ? "Needs follow-up" : "All clear"} tone={due > 0 ? "rose" : "emerald"} />
                  <HeroSignal label="Open work" value={num(totalWork)} note={totalWork > 0 ? "Queue active" : "Queue clear"} tone={totalWork > 0 ? "violet" : "emerald"} />
                  <HeroSignal label="Company pay" value={num(companyPending.count)} note={companyPending.count > 0 ? "Pending" : "Clear"} tone={companyPending.count > 0 ? "amber" : "emerald"} />
                </div>
                <div className="mt-5 flex flex-wrap gap-2.5"><Link href="/accounts/outstanding" className="rounded-[13px] bg-white px-4 py-2.5 text-[10px] font-semibold text-[#0e2347] shadow-[0_9px_22px_rgba(0,0,0,.14)] transition hover:-translate-y-0.5">Review collections</Link><Link href="/insurance/motor" className="rounded-[13px] border border-white/10 bg-white/[.07] px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-white/[.11]">Create motor policy</Link></div>
              </div>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/82 p-5 shadow-[0_18px_48px_rgba(38,69,127,.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[.05] lg:col-span-5">
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-300/20 blur-3xl dark:bg-violet-500/10" />
            <div className="relative flex items-start justify-between"><div><p className="text-[8px] font-bold uppercase tracking-[.2em] text-violet-500">Do now</p><h2 className="mt-1.5 text-[20px] font-[650] tracking-[-.035em] dark:text-white">Fast task dock</h2><p className="mt-1 text-[9px] text-[#98a5ba]">Start your most-used work without hunting menus.</p></div><span className="grid h-10 w-10 place-items-center rounded-[14px] bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"><Icon name="plus" className="h-4 w-4" /></span></div>
            <div className="relative mt-4 grid grid-cols-2 gap-2">{primaryActions.map(([label, desc, href, icon, tone]) => <DockAction key={label} label={label} desc={desc} href={href} icon={icon} tone={tone} />)}</div>
          </article>

          <article className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/82 p-5 shadow-[0_18px_48px_rgba(38,69,127,.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[.05] lg:col-span-3">
            <p className="text-[8px] font-bold uppercase tracking-[.2em] text-cyan-600">Portfolio</p><h2 className="mt-1.5 text-[18px] font-[650] tracking-[-.03em] dark:text-white">Active book</h2>
            <div className="mt-5 grid grid-cols-2 gap-2"><CompactMetric label="Policies" value={num(policies)} tone="blue" /><CompactMetric label="Vehicles" value={num(vehicles)} tone="cyan" /></div>
            <Link href="/insurance" className="mt-4 flex items-center justify-between rounded-[14px] bg-[#f6f9ff] px-3.5 py-3 text-[9px] font-semibold text-[#64748f] transition hover:bg-blue-50 dark:bg-white/[.04] dark:text-slate-300">Open insurance book <Icon name="arrow" className="h-3 w-3" /></Link>
          </article>

          <article className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#6d4cff] via-[#7357ff] to-[#397cff] p-5 text-white shadow-[0_20px_48px_rgba(96,72,240,.25)] lg:col-span-2">
            <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex h-full flex-col justify-between"><div><p className="text-[8px] font-bold uppercase tracking-[.18em] text-white/55">Attention</p><p className="mt-3 text-[38px] font-[650] leading-none tracking-[-.05em]">{num(totalWork)}</p><p className="mt-1 text-[10px] text-white/65">open tasks</p></div><Link href="#pending-work" className="mt-5 flex items-center justify-between rounded-[13px] bg-white/12 px-3 py-2.5 text-[9px] font-semibold backdrop-blur-lg">Review queue <Icon name="arrow" className="h-3 w-3" /></Link></div>
          </article>
        </section>

        {serviceDue > 0 && <Link href="/accounts/outstanding" className="mb-4 flex items-center justify-between rounded-[17px] border border-amber-200/70 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 px-5 py-3 text-[10px] font-semibold text-amber-900 dark:border-amber-900/40 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-rose-950/10 dark:text-amber-200"><span>Service collection needs attention</span><strong>{money(serviceDue)} →</strong></Link>}

        <section className="mb-4 grid gap-4 xl:grid-cols-12">
          <article id="pending-work" className="overflow-hidden rounded-[28px] border border-white/80 bg-white/82 shadow-[0_18px_50px_rgba(38,69,127,.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[.05] xl:col-span-7">
            <div className="flex items-end justify-between border-b border-[#edf2fb] px-5 py-5 sm:px-6 dark:border-white/10"><div><p className="text-[8px] font-bold uppercase tracking-[.2em] text-violet-500">Priority queue</p><h2 className="mt-1.5 text-[21px] font-[650] tracking-[-.035em] dark:text-white">What actually needs attention</h2><p className="mt-1 text-[9px] text-[#94a0b5]">No dashboard theatre — only work that should move next.</p></div><div className="rounded-[15px] bg-violet-50 px-4 py-3 text-right dark:bg-violet-500/10"><p className="text-[22px] font-[650] leading-none text-violet-700 dark:text-violet-300">{num(totalWork)}</p><p className="mt-1 text-[7px] uppercase tracking-[.13em] text-violet-400">open</p></div></div>
            <div className="p-3 sm:p-4">{work.length ? <div className="grid gap-2 md:grid-cols-2">{work.slice(0, 8).map(([label, value], index) => <QueueRow key={label} label={label} value={value} tone={(["blue", "violet", "cyan", "amber"] as Tone[])[index % 4]} />)}</div> : <div className="grid min-h-52 place-items-center text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-gradient-to-br from-emerald-100 to-cyan-100 text-emerald-600 dark:from-emerald-500/15 dark:to-cyan-500/15 dark:text-emerald-300"><Icon name="shield" className="h-6 w-6" /></div><p className="mt-4 text-[13px] font-bold dark:text-white">Everything is under control</p><p className="mt-1 text-[9px] text-[#9aa6b8]">No pending work in this period.</p></div></div>}</div>
          </article>

          <article className="relative overflow-hidden rounded-[28px] bg-[#0c1934] p-5 text-white shadow-[0_24px_54px_-28px_rgba(10,35,90,.6)] sm:p-6 xl:col-span-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(6,182,212,.25),transparent_34%),radial-gradient(circle_at_0%_100%,rgba(99,102,241,.2),transparent_35%)]" />
            <div className="relative flex items-start justify-between"><div><p className="text-[8px] font-bold uppercase tracking-[.2em] text-cyan-300/70">Money control</p><h2 className="mt-1.5 text-[21px] font-[650] tracking-[-.035em]">Financial cockpit</h2><p className="mt-1 text-[9px] text-white/42">Receivable, payable and insurer settlement in one glance.</p></div><span className="grid h-11 w-11 place-items-center rounded-[16px] bg-white/10 text-cyan-200"><Icon name="wallet" className="h-5 w-5" /></span></div>
            <div className="relative mt-5 grid grid-cols-2 gap-2.5"><MoneyTile label="Customer due" value={money(customerReceivable)} tone="cyan" /><MoneyTile label="Payable" value={money(payable)} tone={payable > 0 ? "rose" : "emerald"} /><MoneyTile label="Commission" value={money(commissionDue)} tone="violet" /><MoneyTile label="Company pay" value={money(companyPending.amount)} tone={companyPending.count > 0 ? "amber" : "emerald"} note={`${companyPending.count} pending`} /></div>
            {otherReceivable > 0 && <p className="relative mt-3 text-[8px] text-white/35">Includes {money(otherReceivable)} other ledger receivable.</p>}
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <article className="rounded-[28px] border border-white/80 bg-white/82 p-5 shadow-[0_16px_44px_rgba(38,69,127,.06)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[.05] sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[8px] font-bold uppercase tracking-[.2em] text-blue-500">Workspace</p><h2 className="mt-1.5 text-[19px] font-[650] tracking-[-.03em] dark:text-white">Secondary tools</h2></div><span className="text-[8px] text-[#9aa6b8]">Everything else</span></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{secondaryActions.map(([label, desc, href, icon, tone]) => <ToolTile key={label} label={label} desc={desc} href={href} icon={icon} tone={tone} />)}</div></article>
          <Link href="/reports" className="group relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#15366f] to-[#172445] p-5 text-white shadow-[0_18px_46px_rgba(20,45,100,.2)]"><div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-blue-400/15 blur-2xl" /><div className="relative flex h-full min-h-[142px] flex-col justify-between"><span className="grid h-10 w-10 place-items-center rounded-[14px] bg-white/10"><Icon name="reports" className="h-4 w-4" /></span><div><p className="text-[8px] uppercase tracking-[.18em] text-white/45">Deep dive</p><h3 className="mt-1 text-[18px] font-[650]">Open reports</h3><p className="mt-1 text-[9px] text-white/45">P&L, commissions and business analytics.</p></div><Icon name="arrow" className="absolute bottom-0 right-0 h-4 w-4 transition group-hover:translate-x-1" /></div></Link>
        </section>
      </div>
    </main>
  );
}

function HeroSignal({ label, value, note, tone }: { label: string; value: string; note: string; tone: Tone }) {
  const t = toneStyles[tone];
  return <div className="rounded-[18px] border border-white/10 bg-white/[.065] p-3.5 backdrop-blur-xl"><div className="flex items-center justify-between"><span className="text-[8px] uppercase tracking-[.14em] text-white/42">{label}</span><span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /></div><p className="mt-2 text-[21px] font-[650] leading-none">{value}</p><p className="mt-1 text-[8px] text-white/40">{note}</p></div>;
}

function DockAction({ label, desc, href, icon, tone }: { label: string; desc: string; href: string; icon: string; tone: Tone }) {
  const t = toneStyles[tone];
  return <Link href={href} className="group flex items-center gap-3 rounded-[16px] bg-[#f7f9ff] p-3 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_9px_22px_rgba(45,72,125,.08)] dark:bg-white/[.04] dark:hover:bg-white/[.07]"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[12px] ${t.icon}`}><Icon name={icon} className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-[10px] font-semibold dark:text-white">{label}</span><span className="mt-0.5 block truncate text-[8px] text-[#a0acbd]">{desc}</span></span></Link>;
}

function CompactMetric({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const t = toneStyles[tone];
  return <div className="rounded-[16px] bg-[#f7f9ff] p-3 dark:bg-white/[.04]"><div className="flex items-center gap-1.5 text-[7px] uppercase tracking-[.12em] text-[#95a2b5]"><span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />{label}</div><p className="mt-2 text-[21px] font-[650] leading-none tracking-[-.04em] dark:text-white">{value}</p></div>;
}

function QueueRow({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const t = toneStyles[tone];
  return <Link href="/vehicles" className="group flex items-center gap-3 rounded-[17px] bg-[#f8faff] px-3.5 py-3 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_9px_22px_rgba(45,72,125,.07)] dark:bg-white/[.035] dark:hover:bg-white/[.07]"><span className={`grid h-9 w-9 place-items-center rounded-[12px] ${t.icon}`}><Icon name="clock" className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold capitalize dark:text-white">{label.replaceAll("_", " ")}</span><span className={`mt-0.5 flex items-center gap-1.5 text-[8px] ${t.text}`}><span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />Needs follow-up</span></span><strong className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] text-[#42567d] shadow-sm dark:bg-white/10 dark:text-white">{value}</strong></Link>;
}

function MoneyTile({ label, value, tone, note }: { label: string; value: string; tone: Tone; note?: string }) {
  const t = toneStyles[tone];
  return <div className={`relative overflow-hidden rounded-[18px] border border-white/10 bg-gradient-to-br ${t.wash} p-3.5`}><div className="absolute inset-0 bg-white/[.035]" /><div className="relative"><div className="flex items-center justify-between"><span className="text-[8px] uppercase tracking-[.13em] text-white/42">{label}</span><span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /></div><p className="mt-3 truncate text-[17px] font-[650] tracking-[-.03em]">{value}</p>{note && <p className="mt-1 text-[7px] text-white/35">{note}</p>}</div></div>;
}

function ToolTile({ label, desc, href, icon, tone }: { label: string; desc: string; href: string; icon: string; tone: Tone }) {
  const t = toneStyles[tone];
  return <Link href={href} className="group rounded-[16px] bg-[#f8faff] p-3 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_9px_22px_rgba(45,72,125,.07)] dark:bg-white/[.035] dark:hover:bg-white/[.07]"><span className={`grid h-8 w-8 place-items-center rounded-[11px] ${t.icon}`}><Icon name={icon} className="h-3.5 w-3.5" /></span><span className="mt-2.5 block text-[9px] font-semibold dark:text-white">{label}</span><span className="mt-0.5 block truncate text-[7px] text-[#a0acbd]">{desc}</span></Link>;
}
