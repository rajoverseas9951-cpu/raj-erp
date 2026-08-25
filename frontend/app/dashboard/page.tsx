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
type Action = readonly [string, string, string, string, string];

const quickActions: readonly Action[] = [
  ["Motor policy", "Issue / renew", "/insurance/motor", "shield", "from-blue-500 to-indigo-600"],
  ["New customer", "Create profile", "/customers/new", "customers", "from-violet-500 to-fuchsia-600"],
  ["New vehicle", "Add RC / vehicle", "/vehicles/new", "vehicle", "from-cyan-500 to-blue-600"],
  ["Receive / Pay", "Cash & bank", "/accounts/cash-bank", "credit", "from-emerald-500 to-teal-600"],
];

const tools: readonly Action[] = [
  ["Outstanding", "Receivable / payable", "/accounts/outstanding", "wallet", ""],
  ["Accounts", "Daily accounts", "/accounts", "book", ""],
  ["Non-motor", "Property & business", "/insurance/non_motor", "shield", ""],
  ["Health", "Health insurance", "/insurance/health", "shield", ""],
  ["RTO work", "Vehicle services", "/vehicles", "building", ""],
  ["Reports", "Business reports", "/reports", "reports", ""],
];

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
    <main className="min-h-screen bg-[#f5f7fb] pb-10 text-[#15233d] antialiased dark:bg-[#080c14] dark:text-slate-100">
      <div className="mx-auto max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#7c8ba4]"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.75)]" />Vimawallah workspace</p>
            <h1 className="mt-2 text-[38px] font-semibold leading-none tracking-[-.05em] text-[#112441] sm:text-[46px] dark:text-white">{clock.greeting}</h1>
            <p className="mt-2.5 text-[12px] font-medium text-[#8e9bb0]">{clock.date} · {clock.time} IST</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e6eaf1] bg-white p-2 shadow-[0_12px_30px_rgba(40,59,97,.06)] dark:border-white/10 dark:bg-white/[.05]">
            <select value={period} onChange={(e) => setPeriod(e.target.value as DashboardPeriod)} className="h-10 min-w-40 rounded-xl border-0 bg-transparent px-3 text-[11px] font-semibold text-[#55647d] outline-none dark:text-slate-200">{DASHBOARD_PERIODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <button onClick={() => void refresh(true)} disabled={refreshing} className="h-10 rounded-xl px-4 text-[11px] font-semibold text-[#66758c] transition hover:bg-[#f4f7fb] disabled:opacity-50 dark:hover:bg-white/10">{refreshing ? "Refreshing…" : "Refresh"}</button>
            <Link href="/reports" className="flex h-10 items-center gap-2 rounded-xl bg-[#10264b] px-4 text-[11px] font-semibold text-white">Reports <Icon name="arrow" className="h-3.5 w-3.5" /></Link>
          </div>
        </header>

        {period === "custom" && <div className="mb-5 grid gap-3 rounded-2xl border border-[#e6eaf1] bg-white p-3 sm:grid-cols-[1fr_1fr_auto] dark:border-white/10 dark:bg-white/[.05]"><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-xl border border-[#dde3ec] bg-white px-3 text-xs outline-none dark:border-white/10 dark:bg-white/[.05]" /><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-xl border border-[#dde3ec] bg-white px-3 text-xs outline-none dark:border-white/10 dark:bg-white/[.05]" /><button onClick={() => void refresh(true)} className="h-10 rounded-xl bg-[#1768ff] px-5 text-xs font-semibold text-white">Apply</button></div>}
        {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

        <section className="grid gap-5 xl:grid-cols-[1.55fr_.45fr]">
          <article className="relative overflow-hidden rounded-[32px] bg-[#07172f] text-white shadow-[0_28px_70px_-34px_rgba(17,47,111,.55)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(33,105,255,.55),transparent_31%),radial-gradient(circle_at_92%_8%,rgba(101,74,255,.38),transparent_30%)]" />
            <div className="relative p-7 sm:p-9 lg:p-10">
              <div className="flex flex-wrap items-center gap-3"><span className="rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-cyan-100">Today’s collection position</span><span className="rounded-full bg-white/[.06] px-3 py-1.5 text-[9px] font-semibold text-white/55">{dashboardPeriodLabel(period)}</span></div>
              <p className="mt-7 text-[58px] font-semibold leading-none tracking-[-.06em] sm:text-[76px] xl:text-[84px]">{money(totalReceivable)}</p>
              <div className="mt-8 grid gap-px overflow-hidden rounded-[22px] border border-white/10 bg-white/10 sm:grid-cols-4">
                <HeroMetric label="Renewals due" value={num(due)} note="Follow-up" accent="amber" />
                <HeroMetric label="Open work" value={num(totalWork)} note="Pending" accent="blue" />
                <HeroMetric label="Company payment" value={money(companyPending.amount)} note={`${companyPending.count} pending`} accent="emerald" />
                <HeroMetric label="Customer due" value={money(customerReceivable)} note="Collectable" accent="cyan" />
              </div>
            </div>
          </article>

          <aside className="overflow-hidden rounded-[30px] border border-[#e4e9f1] bg-white shadow-[0_18px_48px_rgba(38,58,96,.07)] dark:border-white/10 dark:bg-white/[.05]">
            <div className="border-b border-[#edf0f5] px-5 py-5 dark:border-white/10">
              <p className="text-[9px] font-bold uppercase tracking-[.17em] text-blue-500">Quick actions</p>
              <h2 className="mt-1.5 text-[23px] font-semibold tracking-[-.035em] text-[#192d4c] dark:text-white">Start work</h2>
            </div>
            <div className="grid grid-cols-2 gap-px bg-[#edf0f5] dark:bg-white/10">
              {quickActions.map(([label, desc, href, icon, gradient]) => <QuickAction key={label} label={label} desc={desc} href={href} icon={icon} gradient={gradient} />)}
            </div>
          </aside>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <article id="pending-work" className="overflow-hidden rounded-[30px] border border-[#e4e9f1] bg-white shadow-[0_18px_48px_rgba(38,58,96,.07)] dark:border-white/10 dark:bg-white/[.05]">
            <div className="flex flex-col gap-3 border-b border-[#edf0f5] px-6 py-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
              <div><p className="text-[9px] font-bold uppercase tracking-[.17em] text-violet-500">Priority work board</p><h2 className="mt-1.5 text-[25px] font-semibold tracking-[-.035em] text-[#192d4c] dark:text-white">What needs attention now</h2></div>
              <div className="rounded-xl bg-violet-50 px-3 py-2 text-right dark:bg-violet-500/10"><p className="text-[22px] font-bold leading-none text-violet-700 dark:text-violet-300">{num(totalWork)}</p><p className="mt-1 text-[8px] font-bold uppercase tracking-[.12em] text-violet-400">open items</p></div>
            </div>
            <div className="p-3 sm:p-4">
              {work.length ? <div className="divide-y divide-[#eef1f5] dark:divide-white/10">{work.slice(0, 7).map(([label, value], index) => <WorkRow key={label} label={label} value={value} index={index} />)}</div> : <div className="grid min-h-64 place-items-center text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><Icon name="shield" className="h-6 w-6" /></span><p className="mt-4 text-sm font-bold">No pending work</p><p className="mt-1 text-[11px] text-[#93a0b4]">Everything is under control for this period.</p></div></div>}
            </div>
          </article>

          <article className="overflow-hidden rounded-[30px] bg-[#102443] text-white shadow-[0_24px_56px_-28px_rgba(18,40,82,.55)]">
            <div className="px-6 py-6">
              <p className="text-[9px] font-bold uppercase tracking-[.17em] text-cyan-300">Financial overview</p>
              <p className="mt-2 text-[11px] text-white/50">Live receivable and payable position.</p>
              <div className="mt-7 space-y-1">
                <FinanceLine label="Total receivable" value={money(totalReceivable)} tone="cyan" />
                <FinanceLine label="Customer due" value={money(customerReceivable)} tone="blue" />
                <FinanceLine label="Payable" value={money(payable)} tone={payable > 0 ? "rose" : "emerald"} />
                <FinanceLine label="Commission due" value={money(commissionDue)} tone="violet" />
                <FinanceLine label="Company payments" value={money(companyPending.amount)} note={`${companyPending.count} pending`} tone="amber" />
                {serviceDue > 0 && <FinanceLine label="Service due" value={money(serviceDue)} tone="amber" />}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-2"><Link href="/accounts/outstanding" className="rounded-xl bg-white px-3 py-3 text-center text-[10px] font-bold text-[#102443]">Open outstanding</Link><Link href="/accounts/cash-bank" className="rounded-xl border border-white/10 bg-white/[.07] px-3 py-3 text-center text-[10px] font-bold text-white">Receive / Pay</Link></div>
              {otherReceivable > 0 && <p className="mt-4 text-[9px] leading-5 text-white/35">Other ledger receivable included: {money(otherReceivable)}</p>}
            </div>
          </article>
        </section>

        <section className="mt-5 overflow-hidden rounded-[28px] border border-[#e4e9f1] bg-white shadow-[0_14px_36px_rgba(38,58,96,.05)] dark:border-white/10 dark:bg-white/[.05]">
          <div className="grid lg:grid-cols-[1fr_1fr_1fr_1fr]">
            <BottomStat label="Active policies" value={num(policies)} href="/insurance" />
            <BottomStat label="Vehicles" value={num(vehicles)} href="/vehicles" />
            <BottomStat label="Renewals due" value={num(due)} href="/insurance" alert={due > 0} />
            <BottomStat label="Company pending" value={num(companyPending.count)} href="/insurance" alert={companyPending.count > 0} />
          </div>
          <div className="border-t border-[#edf0f5] px-5 py-4 dark:border-white/10"><div className="flex flex-wrap gap-2">{tools.map(([label, desc, href, icon]) => <ToolLink key={label} label={label} desc={desc} href={href} icon={icon} />)}</div></div>
        </section>
      </div>
    </main>
  );
}

function HeroMetric({ label, value, note, accent }: { label: string; value: string; note: string; accent: "amber" | "blue" | "emerald" | "cyan" }) {
  const text = accent === "amber" ? "text-amber-300" : accent === "emerald" ? "text-emerald-300" : accent === "cyan" ? "text-cyan-300" : "text-blue-300";
  return <div className="bg-white/[.055] p-4 sm:p-5"><p className="text-[8px] font-bold uppercase tracking-[.14em] text-white/45">{label}</p><p className={`mt-3 truncate text-[20px] font-bold tracking-[-.03em] ${text}`}>{value}</p><p className="mt-1 text-[8px] text-white/35">{note}</p></div>;
}

function QuickAction({ label, desc, href, icon, gradient }: { label: string; desc: string; href: string; icon: string; gradient: string }) {
  return <Link href={href} className="group bg-white p-5 transition hover:bg-[#f8faff] dark:bg-[#0d1420] dark:hover:bg-white/[.06]"><span className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}><Icon name={icon} className="h-4.5 w-4.5" /></span><p className="mt-4 text-[12px] font-bold text-[#233755] dark:text-white">{label}</p><p className="mt-1 text-[9px] text-[#98a5b7]">{desc}</p></Link>;
}

function WorkRow({ label, value, index }: { label: string; value: number; index: number }) {
  const tone = index % 4 === 0 ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" : index % 4 === 1 ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300" : index % 4 === 2 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300";
  return <Link href="/vehicles" className="group flex items-center gap-4 px-2 py-4 transition hover:bg-[#f9fbfe] dark:hover:bg-white/[.03]"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon name={index % 2 ? "building" : "clock"} className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold capitalize text-[#2a3d59] dark:text-white">{label.replaceAll("_", " ")}</span><span className="mt-1 block text-[9px] text-[#9ba7b8]">Needs follow-up</span></span><span className="rounded-xl bg-[#f4f6fa] px-3 py-2 text-[11px] font-bold text-[#45566f] dark:bg-white/10 dark:text-white">{value}</span><Icon name="arrow" className="h-3.5 w-3.5 text-[#a5b0c0] transition group-hover:translate-x-1" /></Link>;
}

function FinanceLine({ label, value, tone, note }: { label: string; value: string; tone: "cyan" | "blue" | "rose" | "emerald" | "violet" | "amber"; note?: string }) {
  const color = tone === "cyan" ? "text-cyan-300" : tone === "blue" ? "text-blue-300" : tone === "rose" ? "text-rose-300" : tone === "emerald" ? "text-emerald-300" : tone === "violet" ? "text-violet-300" : "text-amber-300";
  return <div className="flex items-center justify-between gap-4 border-b border-white/[.07] py-3.5 last:border-b-0"><div><p className="text-[10px] font-medium text-white/60">{label}</p>{note && <p className="mt-1 text-[8px] text-white/30">{note}</p>}</div><p className={`text-[12px] font-bold tabular-nums ${color}`}>{value}</p></div>;
}

function BottomStat({ label, value, href, alert = false }: { label: string; value: string; href: string; alert?: boolean }) {
  return <Link href={href} className="border-b border-[#edf0f5] px-5 py-5 transition hover:bg-[#fafbfd] lg:border-b-0 lg:border-r last:lg:border-r-0 dark:border-white/10 dark:hover:bg-white/[.03]"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#8d9aad]">{label}</p><p className={`mt-2 text-[26px] font-semibold tracking-[-.04em] ${alert ? "text-amber-600 dark:text-amber-300" : "text-[#1b3152] dark:text-white"}`}>{value}</p></Link>;
}

function ToolLink({ label, desc, href, icon }: { label: string; desc: string; href: string; icon: string }) {
  return <Link href={href} className="flex items-center gap-2.5 rounded-xl border border-[#e7ebf1] bg-[#fafbfd] px-3 py-2.5 transition hover:border-blue-200 hover:bg-blue-50 dark:border-white/10 dark:bg-white/[.03] dark:hover:bg-white/[.07]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[#56708e] shadow-sm dark:bg-white/10 dark:text-slate-300"><Icon name={icon} className="h-3.5 w-3.5" /></span><span><span className="block text-[9px] font-semibold text-[#3f516c] dark:text-white">{label}</span><span className="block text-[7px] text-[#9ca7b6]">{desc}</span></span></Link>;
}
