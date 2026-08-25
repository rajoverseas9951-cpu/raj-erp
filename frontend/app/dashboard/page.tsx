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
const actions: readonly Action[] = [
  ["Motor policy", "Issue or renew", "/insurance/motor", "shield"],
  ["New customer", "Create profile", "/customers/new", "customers"],
  ["New vehicle", "Add RC / vehicle", "/vehicles/new", "vehicle"],
  ["Receive / Pay", "Cash & bank", "/accounts/cash-bank", "credit"],
];

function indiaNowParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
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
        } catch {
          return p;
        }
      }));
      const pending = checks.filter((p): p is PolicyRow => Boolean(p));
      setCompanyPending({ count: pending.length, amount: pending.reduce((sum, p) => sum + Number(p.customer_pay || p.gross_premium || 0), 0) });
    } catch {
      setCompanyPending({ count: 0, amount: 0 });
    }
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
        if (req.current === controller) {
          setRefreshing(false);
          req.current = null;
        }
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
    <main className="min-h-screen bg-[#eef3ff] pb-12 text-[#12233f] antialiased dark:bg-[#060914] dark:text-slate-100" style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", Inter, ui-sans-serif, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#7284a4]"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />Vimawallah workspace</div>
            <h1 className="mt-2 text-[40px] font-semibold leading-none tracking-[-.05em] text-[#10213f] sm:text-[50px] dark:text-white">{clock.greeting}</h1>
            <p className="mt-3 text-[13px] font-medium text-[#8b9ab3]">{clock.date} · {clock.time} IST</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white bg-white/80 p-2 shadow-[0_16px_40px_rgba(48,73,122,.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[.06]">
            <select value={period} onChange={(e) => setPeriod(e.target.value as DashboardPeriod)} className="h-11 min-w-44 rounded-xl border-0 bg-transparent px-4 text-[12px] font-semibold text-[#52627d] outline-none dark:text-slate-200">{DASHBOARD_PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <button onClick={() => void refresh(true)} disabled={refreshing} className="h-11 rounded-xl px-4 text-[12px] font-semibold text-[#66748d] transition hover:bg-blue-50 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10">{refreshing ? "Refreshing…" : "Refresh"}</button>
            <Link href="/reports" className="flex h-11 items-center gap-2 rounded-xl bg-[#14284e] px-5 text-[12px] font-semibold text-white shadow-[0_10px_24px_rgba(20,40,78,.22)]">Reports <Icon name="arrow" className="h-4 w-4" /></Link>
          </div>
        </header>

        {period === "custom" && <div className="mb-5 grid gap-3 rounded-2xl border border-white bg-white/80 p-3 sm:grid-cols-[1fr_1fr_auto] dark:border-white/10 dark:bg-white/[.06]"><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11 rounded-xl border border-[#dbe4f2] bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-white/[.06]" /><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11 rounded-xl border border-[#dbe4f2] bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-white/[.06]" /><button onClick={() => void refresh(true)} className="h-11 rounded-xl bg-gradient-to-r from-[#1768ff] to-[#7656ff] px-6 text-sm font-semibold text-white">Apply period</button></div>}
        {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>}

        <section className="mb-5 grid gap-5 xl:grid-cols-[1.45fr_.55fr]">
          <article className="relative min-h-[430px] overflow-hidden rounded-[36px] bg-[#081733] text-white shadow-[0_30px_80px_-32px_rgba(18,48,120,.62)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(23,104,255,.62),transparent_30%),radial-gradient(circle_at_92%_5%,rgba(119,82,255,.52),transparent_32%),radial-gradient(circle_at_72%_100%,rgba(0,211,255,.26),transparent_34%)]" />
            <div className="absolute -right-24 -top-28 h-96 w-96 rounded-full border border-white/10" />
            <div className="relative flex min-h-[430px] flex-col justify-between p-7 sm:p-9 lg:p-10">
              <div>
                <div className="flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.08] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-cyan-100"><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.9)]" />Live business overview</span><span className="rounded-full bg-white/[.06] px-3.5 py-2 text-[10px] font-semibold text-white/60">{dashboardPeriodLabel(period)}</span></div>
                <p className="mt-8 text-[11px] font-semibold uppercase tracking-[.18em] text-white/50">Total collection position</p>
                <p className="mt-3 text-[58px] font-semibold leading-none tracking-[-.06em] sm:text-[74px] xl:text-[82px]">{money(totalReceivable)}</p>
                <p className="mt-4 max-w-2xl text-[14px] leading-7 text-blue-100/60">Your live receivable position with the three signals that matter most today.</p>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                <BigSignal label="Customer due" value={money(customerReceivable)} note="Collectable" tone="cyan" />
                <BigSignal label="Payable" value={money(payable)} note={payable > 0 ? "Needs attention" : "Clear"} tone={payable > 0 ? "rose" : "emerald"} />
                <BigSignal label="Company payment" value={money(companyPending.amount)} note={`${companyPending.count} pending`} tone={companyPending.count > 0 ? "amber" : "emerald"} />
              </div>
            </div>
          </article>

          <aside className="flex min-h-[430px] flex-col overflow-hidden rounded-[34px] border border-white bg-white/85 shadow-[0_24px_60px_rgba(42,69,123,.10)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[.06]">
            <div className="border-b border-[#e9eef8] px-6 py-6 dark:border-white/10">
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-500">Quick start</p>
              <h2 className="mt-2 text-[28px] font-semibold tracking-[-.04em] text-[#172c50] dark:text-white">Start your work</h2>
              <p className="mt-2 text-[12px] leading-5 text-[#8f9db3]">Your four most-used actions, kept large and easy to hit.</p>
            </div>
            <div className="grid flex-1 grid-cols-2">
              {actions.map(([label, desc, href, icon], index) => <LargeAction key={label} label={label} desc={desc} href={href} icon={icon} index={index} />)}
            </div>
          </aside>
        </section>

        <section className="mb-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <article id="pending-work" className="min-h-[390px] overflow-hidden rounded-[34px] border border-white bg-white/85 shadow-[0_24px_60px_rgba(42,69,123,.09)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[.06]">
            <div className="flex flex-col gap-4 border-b border-[#e9eef8] px-6 py-6 sm:flex-row sm:items-end sm:justify-between dark:border-white/10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-500">Work board</p>
                <h2 className="mt-2 text-[30px] font-semibold tracking-[-.04em] text-[#172c50] dark:text-white">What needs attention</h2>
                <p className="mt-2 text-[12px] text-[#91a0b5]">A single board for pending operational work and renewals.</p>
              </div>
              <div className="flex gap-3"><CountBadge label="Open work" value={totalWork} tone="violet" /><CountBadge label="Renewals" value={due} tone={due > 0 ? "rose" : "emerald"} /></div>
            </div>
            <div className="p-5 sm:p-6">
              {work.length ? <div className="grid gap-3 md:grid-cols-2">{work.slice(0, 6).map(([label, value], index) => <WorkRow key={label} label={label} value={value} index={index} />)}</div> : <div className="grid min-h-[240px] place-items-center text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"><Icon name="shield" className="h-7 w-7" /></div><p className="mt-4 text-lg font-semibold text-[#263c5f] dark:text-white">Everything is under control</p><p className="mt-1 text-sm text-[#95a2b5]">No pending work needs attention in this period.</p></div></div>}
            </div>
          </article>

          <aside className="min-h-[390px] rounded-[34px] bg-[#102546] p-6 text-white shadow-[0_28px_65px_-28px_rgba(16,37,70,.55)] sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">Money board</p><h2 className="mt-2 text-[29px] font-semibold tracking-[-.04em]">Financial position</h2><p className="mt-2 text-[12px] leading-5 text-blue-100/50">One place to see what is coming in and going out.</p></div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-cyan-200"><Icon name="wallet" className="h-5 w-5" /></span></div>
            <div className="mt-7 divide-y divide-white/10">
              <MoneyLine label="Total receivable" value={money(totalReceivable)} href="/accounts/outstanding" />
              <MoneyLine label="Total payable" value={money(payable)} href="/accounts/outstanding" danger={payable > 0} />
              <MoneyLine label="Commission due" value={money(commissionDue)} href="/reports/insurance-commission" />
              <MoneyLine label={`Company payments · ${companyPending.count} pending`} value={money(companyPending.amount)} href="/insurance/company-payments" danger={companyPending.count > 0} />
            </div>
            {otherReceivable > 0 && <p className="mt-5 rounded-2xl bg-white/[.06] px-4 py-3 text-[11px] leading-5 text-blue-100/55">Includes {money(otherReceivable)} in other ledger receivables.</p>}
          </aside>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <article className="rounded-[32px] border border-white bg-white/85 p-6 shadow-[0_22px_55px_rgba(42,69,123,.08)] dark:border-white/10 dark:bg-white/[.06]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-500">Business book</p><h2 className="mt-2 text-[27px] font-semibold tracking-[-.04em] text-[#172c50] dark:text-white">Your active business</h2></div><Link href="/insurance" className="text-sm font-semibold text-blue-600 dark:text-blue-300">Open insurance →</Link></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3"><BusinessNumber label="Active policies" value={num(policies)} /><BusinessNumber label="Vehicles" value={num(vehicles)} /><BusinessNumber label="Service due" value={money(serviceDue)} /></div>
          </article>
          <article className="rounded-[32px] bg-gradient-to-br from-[#5a58ff] via-[#6f4dff] to-[#9b49df] p-6 text-white shadow-[0_24px_60px_-28px_rgba(95,70,230,.60)]">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/60">Continue working</p>
            <h2 className="mt-2 text-[28px] font-semibold tracking-[-.04em]">Everything else is one click away.</h2>
            <p className="mt-3 max-w-md text-[12px] leading-6 text-white/65">Accounts, RTO, reports and other tools stay available without crowding the main dashboard.</p>
            <div className="mt-6 flex flex-wrap gap-2"><Link href="/accounts" className="rounded-xl bg-white px-4 py-2.5 text-[12px] font-semibold text-[#5336b7]">Accounts</Link><Link href="/vehicles" className="rounded-xl bg-white/10 px-4 py-2.5 text-[12px] font-semibold text-white ring-1 ring-white/15">RTO / Vehicles</Link><Link href="/reports" className="rounded-xl bg-white/10 px-4 py-2.5 text-[12px] font-semibold text-white ring-1 ring-white/15">Reports</Link></div>
          </article>
        </section>
      </div>
    </main>
  );
}

function BigSignal({ label, value, note, tone }: { label: string; value: string; note: string; tone: "cyan" | "rose" | "amber" | "emerald" }) {
  const toneClass = tone === "cyan" ? "text-cyan-200" : tone === "rose" ? "text-rose-200" : tone === "amber" ? "text-amber-200" : "text-emerald-200";
  return <div className="rounded-[24px] border border-white/10 bg-white/[.07] p-5 backdrop-blur-xl"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/45">{label}</p><p className="mt-3 truncate text-[24px] font-semibold tracking-[-.04em] sm:text-[28px]">{value}</p><p className={`mt-2 text-[10px] font-medium ${toneClass}`}>{note}</p></div>;
}

function LargeAction({ label, desc, href, icon, index }: { label: string; desc: string; href: string; icon: string; index: number }) {
  const iconClass = ["bg-blue-50 text-blue-600", "bg-violet-50 text-violet-600", "bg-cyan-50 text-cyan-700", "bg-emerald-50 text-emerald-700"][index % 4];
  return <Link href={href} className="group flex min-h-[150px] flex-col justify-between border-b border-r border-[#e9eef8] p-5 transition hover:bg-[#f7f9ff] dark:border-white/10 dark:hover:bg-white/[.05]"><span className={`grid h-12 w-12 place-items-center rounded-2xl ${iconClass}`}><Icon name={icon} className="h-5 w-5" /></span><span><span className="block text-[16px] font-semibold tracking-[-.02em] text-[#213758] dark:text-white">{label}</span><span className="mt-1 block text-[11px] text-[#93a0b5]">{desc}</span></span></Link>;
}

function CountBadge({ label, value, tone }: { label: string; value: number; tone: "violet" | "rose" | "emerald" }) {
  const cls = tone === "violet" ? "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : tone === "rose" ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  return <div className={`min-w-[100px] rounded-2xl px-4 py-3 text-right ${cls}`}><p className="text-[22px] font-semibold leading-none">{value}</p><p className="mt-1 text-[8px] font-bold uppercase tracking-[.12em] opacity-65">{label}</p></div>;
}

function WorkRow({ label, value, index }: { label: string; value: number; index: number }) {
  const iconClass = ["bg-blue-50 text-blue-600", "bg-violet-50 text-violet-600", "bg-cyan-50 text-cyan-700", "bg-amber-50 text-amber-700"][index % 4];
  return <Link href="/vehicles" className="group flex min-h-[82px] items-center gap-4 rounded-2xl bg-[#f7f9fd] px-4 py-3 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_24px_rgba(40,68,120,.08)] dark:bg-white/[.035] dark:hover:bg-white/[.07]"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${iconClass}`}><Icon name={index % 2 === 0 ? "clock" : "building"} className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold capitalize text-[#2b3e60] dark:text-white">{label.replaceAll("_", " ")}</span><span className="mt-1 block text-[10px] text-[#99a5b7]">Needs follow-up</span></span><span className="text-[22px] font-semibold text-[#273b60] dark:text-white">{value}</span></Link>;
}

function MoneyLine({ label, value, href, danger = false }: { label: string; value: string; href: string; danger?: boolean }) {
  return <Link href={href} className="flex items-center justify-between gap-4 py-5 transition hover:pl-1"><span className="text-[12px] font-medium text-blue-100/60">{label}</span><span className={`text-[16px] font-semibold tracking-[-.02em] ${danger ? "text-amber-200" : "text-white"}`}>{value}</span></Link>;
}

function BusinessNumber({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-[#f5f8ff] px-5 py-5 dark:bg-white/[.04]"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8f9cb0]">{label}</p><p className="mt-3 text-[30px] font-semibold tracking-[-.045em] text-[#213758] dark:text-white">{value}</p></div>;
}
