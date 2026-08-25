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
type Action = readonly [string, string, string, string];

const primaryActions: readonly Action[] = [
  ["Motor policy", "Issue or renew insurance", "/insurance/motor", "shield"],
  ["New customer", "Create customer profile", "/customers/new", "customers"],
  ["New vehicle", "Add RC and vehicle", "/vehicles/new", "vehicle"],
  ["Receive / Pay", "Record cash or bank", "/accounts/cash-bank", "credit"],
];

const tools: readonly Action[] = [
  ["Outstanding", "Receivable & payable", "/accounts/outstanding", "wallet"],
  ["Accounts", "Daily accounts", "/accounts", "book"],
  ["Non-motor", "Property & business", "/insurance/non_motor", "shield"],
  ["Health", "Health insurance", "/insurance/health", "shield"],
  ["RTO work", "Vehicle services", "/vehicles", "building"],
  ["Reports", "P&L and analytics", "/reports", "reports"],
];

function indiaNowParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", weekday: "long", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  }).formatToParts(date);
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
    <main className="min-h-screen bg-[#f2f5fb] pb-10 text-[#11223f] antialiased dark:bg-[#070b14] dark:text-slate-100" style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", Inter, ui-sans-serif, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-[1580px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#71819e]"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />Vimawallah command desk</div>
            <h1 className="mt-2 text-[42px] font-semibold leading-none tracking-[-.055em] text-[#112445] sm:text-[52px] dark:text-white">{clock.greeting}</h1>
            <p className="mt-3 text-[13px] font-medium text-[#8d9bb2]">{clock.date} · {clock.time} IST</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white bg-white/85 p-2 shadow-[0_14px_36px_rgba(46,69,116,.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[.06]">
            <select value={period} onChange={(e) => setPeriod(e.target.value as DashboardPeriod)} className="h-11 min-w-44 rounded-xl border-0 bg-transparent px-4 text-[12px] font-semibold text-[#52617b] outline-none dark:text-slate-200">{DASHBOARD_PERIODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <button onClick={() => void refresh(true)} disabled={refreshing} className="h-11 rounded-xl px-4 text-[12px] font-semibold text-[#66748c] transition hover:bg-blue-50 disabled:opacity-50 dark:hover:bg-white/10">{refreshing ? "Refreshing…" : "Refresh"}</button>
            <Link href="/reports" className="flex h-11 items-center gap-2 rounded-xl bg-[#10264b] px-5 text-[12px] font-semibold text-white shadow-[0_10px_24px_rgba(16,38,75,.22)]">Reports <Icon name="arrow" className="h-4 w-4" /></Link>
          </div>
        </header>

        {period === "custom" && <div className="mb-5 grid gap-3 rounded-2xl border border-white bg-white/85 p-3 sm:grid-cols-[1fr_1fr_auto] dark:border-white/10 dark:bg-white/[.06]"><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11 rounded-xl border border-[#dce4ef] bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-white/[.06]" /><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11 rounded-xl border border-[#dce4ef] bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-white/[.06]" /><button onClick={() => void refresh(true)} className="h-11 rounded-xl bg-gradient-to-r from-[#1768ff] to-[#7456ff] px-6 text-sm font-semibold text-white">Apply</button></div>}
        {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>}

        <section className="grid gap-5 xl:grid-cols-[1.48fr_.52fr]">
          <article className="relative min-h-[560px] overflow-hidden rounded-[38px] bg-[#071632] text-white shadow-[0_34px_86px_-34px_rgba(19,48,118,.66)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_7%_8%,rgba(28,109,255,.62),transparent_31%),radial-gradient(circle_at_93%_7%,rgba(124,79,255,.5),transparent_30%),radial-gradient(circle_at_65%_100%,rgba(0,211,255,.26),transparent_34%)]" />
            <div className="absolute -right-20 -top-24 h-[420px] w-[420px] rounded-full border border-white/10" />
            <div className="relative flex min-h-[560px] flex-col justify-between p-7 sm:p-10 lg:p-12">
              <div>
                <div className="flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.08] px-4 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-cyan-100"><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.9)]" />Live overview</span><span className="rounded-full bg-white/[.06] px-4 py-2 text-[10px] font-semibold text-white/60">{dashboardPeriodLabel(period)}</span></div>
                <p className="mt-9 text-[11px] font-semibold uppercase tracking-[.19em] text-white/48">Total collection position</p>
                <p className="mt-3 text-[64px] font-semibold leading-none tracking-[-.065em] sm:text-[82px] 2xl:text-[96px]">{money(totalReceivable)}</p>
                <p className="mt-5 max-w-2xl text-[14px] leading-7 text-blue-100/60">One large business canvas for the numbers that actually matter today — no dashboard clutter.</p>
              </div>

              <div className="mt-10 grid gap-px overflow-hidden rounded-[26px] border border-white/10 bg-white/10 sm:grid-cols-4">
                <HeroMetric label="Customer due" value={money(customerReceivable)} tone="cyan" />
                <HeroMetric label="Payable" value={money(payable)} tone={payable > 0 ? "rose" : "emerald"} />
                <HeroMetric label="Commission" value={money(commissionDue)} tone="violet" />
                <HeroMetric label="Company pay" value={money(companyPending.amount)} note={`${companyPending.count} pending`} tone={companyPending.count > 0 ? "amber" : "emerald"} />
              </div>
            </div>
          </article>

          <aside className="flex min-h-[560px] flex-col overflow-hidden rounded-[36px] border border-white bg-white/90 shadow-[0_26px_66px_rgba(41,66,118,.10)] dark:border-white/10 dark:bg-white/[.06]">
            <div className="border-b border-[#e9edf5] px-6 py-7 dark:border-white/10">
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-500">Action rail</p>
              <h2 className="mt-2 text-[30px] font-semibold tracking-[-.045em] text-[#172c50] dark:text-white">Start here</h2>
              <p className="mt-2 text-[12px] leading-5 text-[#8d9bb2]">Large, obvious actions for daily work.</p>
            </div>
            <div className="grid flex-1 grid-rows-4 divide-y divide-[#edf1f7] dark:divide-white/10">
              {primaryActions.map(([label, desc, href, icon], index) => <RailAction key={label} label={label} desc={desc} href={href} icon={icon} index={index} />)}
            </div>
          </aside>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.22fr_.78fr]">
          <article id="pending-work" className="min-h-[410px] overflow-hidden rounded-[36px] border border-white bg-white/90 shadow-[0_24px_64px_rgba(42,67,118,.09)] dark:border-white/10 dark:bg-white/[.06]">
            <div className="flex flex-col gap-4 border-b border-[#e9edf5] px-7 py-7 sm:flex-row sm:items-end sm:justify-between dark:border-white/10">
              <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-500">Operations board</p><h2 className="mt-2 text-[30px] font-semibold tracking-[-.045em] text-[#172c50] dark:text-white">Work & renewals</h2><p className="mt-2 text-[12px] text-[#8e9bb0]">One large queue instead of many disconnected task cards.</p></div>
              <div className="flex gap-3"><BoardStat label="Open work" value={num(totalWork)} tone="violet" /><BoardStat label="Renewals" value={num(due)} tone="rose" /></div>
            </div>
            <div className="p-5 sm:p-6">
              {work.length ? <div className="grid gap-3 md:grid-cols-2">{work.slice(0, 8).map(([label, value], i) => <Link key={label} href="/vehicles" className="group flex items-center gap-4 rounded-[20px] bg-[#f7f9fd] px-4 py-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_28px_rgba(44,69,120,.08)] dark:bg-white/[.04] dark:hover:bg-white/[.08]"><span className={`grid h-11 w-11 place-items-center rounded-[15px] ${i % 3 === 0 ? "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" : i % 3 === 1 ? "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" : "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300"}`}><Icon name={i % 2 === 0 ? "clock" : "building"} className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold capitalize text-[#2a3d5e] dark:text-white">{label.replaceAll("_", " ")}</span><span className="mt-1 block text-[10px] text-[#9aa7ba]">Needs follow-up</span></span><span className="text-[22px] font-semibold tracking-[-.04em] text-[#263b61] dark:text-white">{value}</span></Link>)}</div> : <div className="grid min-h-[250px] place-items-center text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"><Icon name="shield" className="h-7 w-7" /></div><p className="mt-4 text-[15px] font-semibold text-[#29405f] dark:text-white">Queue is clear</p><p className="mt-1 text-[11px] text-[#9aa6b8]">No pending work needs attention.</p></div></div>}
            </div>
          </article>

          <article className="relative min-h-[410px] overflow-hidden rounded-[36px] bg-[#10264b] text-white shadow-[0_24px_64px_rgba(17,38,75,.24)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(53,199,255,.23),transparent_35%),radial-gradient(circle_at_0%_100%,rgba(121,83,255,.22),transparent_38%)]" />
            <div className="relative p-7 sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">Money board</p>
              <h2 className="mt-2 text-[30px] font-semibold tracking-[-.045em]">Financial position</h2>
              <p className="mt-2 text-[12px] text-blue-100/55">Everything money-related in one large surface.</p>
              <div className="mt-7 divide-y divide-white/10">
                <MoneyLine label="Receivable" value={money(totalReceivable)} href="/accounts/outstanding" />
                <MoneyLine label="Customer due" value={money(customerReceivable)} href="/accounts/outstanding" />
                <MoneyLine label="Payable" value={money(payable)} href="/accounts/outstanding" danger={payable > 0} />
                <MoneyLine label="Commission due" value={money(commissionDue)} href="/reports/insurance-commission" />
                <MoneyLine label="Company payments" value={money(companyPending.amount)} href="/insurance/company-payments" danger={companyPending.count > 0} note={`${companyPending.count} pending`} />
              </div>
              {otherReceivable > 0 && <p className="mt-6 rounded-2xl bg-white/[.07] px-4 py-3 text-[10px] text-blue-100/55">Includes {money(otherReceivable)} in other ledger receivables.</p>}
            </div>
          </article>
        </section>

        {serviceDue > 0 && <Link href="/accounts/outstanding" className="mt-5 flex items-center justify-between gap-4 rounded-[22px] border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 text-amber-900 shadow-[0_12px_28px_rgba(173,108,18,.07)] dark:border-amber-900/50 dark:from-amber-950/30 dark:to-orange-950/20 dark:text-amber-200"><span className="text-[12px] font-semibold">Service collection needs attention</span><span className="text-[16px] font-bold">{money(serviceDue)} →</span></Link>}

        <section className="mt-5 overflow-hidden rounded-[28px] border border-white bg-white/85 shadow-[0_18px_48px_rgba(42,67,118,.07)] dark:border-white/10 dark:bg-white/[.05]">
          <div className="grid md:grid-cols-6">{tools.map(([label, desc, href, icon], i) => <Link key={label} href={href} className={`group flex min-h-[112px] items-center gap-3 px-5 py-5 transition hover:bg-[#f8faff] dark:hover:bg-white/[.05] ${i ? "border-t border-[#edf1f7] md:border-l md:border-t-0 dark:border-white/10" : ""}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[#eef3fb] text-[#516887] transition group-hover:bg-[#10264b] group-hover:text-white dark:bg-white/10 dark:text-slate-300"><Icon name={icon} className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-[11px] font-semibold text-[#304463] dark:text-white">{label}</span><span className="mt-1 block truncate text-[9px] text-[#9ca8ba]">{desc}</span></span></Link>)}</div>
        </section>
      </div>
    </main>
  );
}

function HeroMetric({ label, value, note, tone }: { label: string; value: string; note?: string; tone: "cyan" | "rose" | "violet" | "amber" | "emerald" }) {
  const toneClass = tone === "cyan" ? "text-cyan-200" : tone === "rose" ? "text-rose-200" : tone === "violet" ? "text-violet-200" : tone === "amber" ? "text-amber-200" : "text-emerald-200";
  return <div className="bg-white/[.065] px-5 py-5 backdrop-blur-xl"><p className="text-[9px] font-semibold uppercase tracking-[.15em] text-white/45">{label}</p><p className="mt-2 truncate text-[20px] font-semibold tracking-[-.035em] sm:text-[23px]">{value}</p>{note && <p className={`mt-1 text-[8px] font-medium ${toneClass}`}>{note}</p>}</div>;
}

function RailAction({ label, desc, href, icon, index }: { label: string; desc: string; href: string; icon: string; index: number }) {
  const styles = ["from-blue-500 to-indigo-600", "from-violet-500 to-fuchsia-600", "from-cyan-500 to-blue-600", "from-emerald-500 to-cyan-600"];
  return <Link href={href} className="group flex items-center gap-4 px-6 py-5 transition hover:bg-[#f8faff] dark:hover:bg-white/[.05]"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-[17px] bg-gradient-to-br ${styles[index]} text-white shadow-[0_10px_22px_rgba(48,75,145,.18)]`}><Icon name={icon} className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-[#253957] dark:text-white">{label}</span><span className="mt-1 block text-[10px] text-[#96a3b5]">{desc}</span></span><Icon name="arrow" className="h-4 w-4 text-[#bcc6d5] transition group-hover:translate-x-1 group-hover:text-blue-500" /></Link>;
}

function BoardStat({ label, value, tone }: { label: string; value: string; tone: "violet" | "rose" }) {
  return <div className={`min-w-[108px] rounded-[18px] px-4 py-3 ${tone === "violet" ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"}`}><p className="text-[9px] font-semibold uppercase tracking-[.12em] opacity-60">{label}</p><p className="mt-1 text-[24px] font-semibold leading-none tracking-[-.04em]">{value}</p></div>;
}

function MoneyLine({ label, value, href, danger = false, note }: { label: string; value: string; href: string; danger?: boolean; note?: string }) {
  return <Link href={href} className="group flex items-center justify-between gap-4 py-4"><span><span className="block text-[11px] font-medium text-blue-100/60">{label}</span>{note && <span className="mt-1 block text-[9px] text-amber-200/70">{note}</span>}</span><span className={`text-[15px] font-semibold tabular-nums transition group-hover:translate-x-0.5 ${danger ? "text-amber-200" : "text-white"}`}>{value}</span></Link>;
}
