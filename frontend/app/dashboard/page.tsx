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

type PolicyRow = {
  id: string;
  vehicle_id: string;
  status: string;
  archived_at?: string | null;
  customer_pay: number;
  gross_premium: number;
};
type PolicyPage = { data: PolicyRow[] };
type SettlementInfo = { settlement: unknown | null };
type ActionItem = readonly [string, string, string, string, "blue" | "cyan" | "violet" | "emerald" | "amber" | "rose"];

const primaryActions: readonly ActionItem[] = [
  ["Motor policy", "Issue or renew insurance", "/insurance/motor", "shield", "blue"],
  ["New customer", "Create customer profile", "/customers/new", "customers", "violet"],
  ["New vehicle", "Add RC and vehicle", "/vehicles/new", "vehicle", "cyan"],
  ["Receive / Pay", "Record cash or bank", "/accounts/cash-bank", "credit", "emerald"],
];

const secondaryActions: readonly ActionItem[] = [
  ["Non-motor", "Property & business", "/insurance/non_motor", "shield", "violet"],
  ["Health", "Health insurance", "/insurance/health", "shield", "rose"],
  ["RTO work", "Vehicle services", "/vehicles", "building", "amber"],
  ["Outstanding", "Receivable / payable", "/accounts/outstanding", "wallet", "cyan"],
  ["Accounts", "Daily accounts", "/accounts", "book", "emerald"],
  ["Reports", "P&L and analytics", "/reports", "reports", "blue"],
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
  return {
    greeting,
    date: `${map.weekday}, ${map.day} ${map.month} ${map.year}`,
    time: `${map.hour}:${map.minute} ${map.dayPeriod}`,
  };
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
      const active = (page?.data ?? []).filter(
        (p) => !p.archived_at && !["cancelled", "expired", "draft"].includes(String(p.status || "").toLowerCase()),
      );
      const checks = await Promise.all(active.map(async (p) => {
        try {
          const settlement = await authenticatedRequest<SettlementInfo>(`/vehicles/${p.vehicle_id}/insurances/${p.id}/settlement`);
          return settlement.settlement ? null : p;
        } catch {
          return p;
        }
      }));
      const pending = checks.filter((p): p is PolicyRow => Boolean(p));
      setCompanyPending({
        count: pending.length,
        amount: pending.reduce((sum, p) => sum + Number(p.customer_pay || p.gross_premium || 0), 0),
      });
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
    <main
      className="min-h-screen overflow-hidden bg-[#f3f6ff] pb-14 text-[#10213f] antialiased dark:bg-[#060914] dark:text-slate-100"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-blue-300/20 blur-3xl dark:bg-blue-500/10" />
        <div className="absolute -right-52 top-24 h-[560px] w-[560px] rounded-full bg-violet-300/20 blur-3xl dark:bg-violet-500/10" />
        <div className="absolute bottom-[-260px] left-[34%] h-[520px] w-[520px] rounded-full bg-cyan-200/20 blur-3xl dark:bg-cyan-500/10" />
      </div>

      <div className="relative mx-auto max-w-[1520px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#175cff] via-[#4775ff] to-[#7b4dff] text-white shadow-[0_14px_30px_rgba(48,88,255,.28)]">
              <Icon name="dashboard" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#7d8ca8] dark:text-slate-500">Vimawallah Command Center</p>
              <h1 className="mt-1 text-[30px] font-[650] leading-none tracking-[-.045em] text-[#132445] sm:text-[36px] dark:text-white">{clock.greeting}</h1>
              <p className="mt-1.5 text-[11px] font-medium text-[#91a0ba]">{clock.date} · {clock.time} IST</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/75 bg-white/70 p-1.5 shadow-[0_10px_35px_rgba(36,65,120,.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[.055]">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
              className="h-10 min-w-40 rounded-xl border-0 bg-transparent px-3 text-[11px] font-semibold text-[#566783] outline-none dark:text-slate-200"
              aria-label="Dashboard period"
            >
              {DASHBOARD_PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button
              onClick={() => void refresh(true)}
              disabled={refreshing}
              className="h-10 rounded-xl px-4 text-[11px] font-semibold text-[#65728a] transition hover:bg-blue-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/10"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <Link href="/reports" className="flex h-10 items-center gap-2 rounded-xl bg-[#14264a] px-4 text-[11px] font-semibold text-white shadow-[0_8px_20px_rgba(20,38,74,.2)] transition hover:-translate-y-0.5 hover:bg-[#0c1b36]">
              Reports <Icon name="arrow" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        {period === "custom" && (
          <div className="mb-4 grid gap-2 rounded-2xl border border-white/75 bg-white/70 p-3 shadow-[0_12px_34px_rgba(36,65,120,.07)] backdrop-blur-xl sm:grid-cols-[1fr_1fr_auto] dark:border-white/10 dark:bg-white/[.05]">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-xl border border-[#dae3f2] bg-white/80 px-3 text-xs font-medium outline-none dark:border-white/10 dark:bg-white/[.06]" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-xl border border-[#dae3f2] bg-white/80 px-3 text-xs font-medium outline-none dark:border-white/10 dark:bg-white/[.06]" />
            <button onClick={() => void refresh(true)} className="h-10 rounded-xl bg-gradient-to-r from-[#175cff] to-[#6b55ff] px-5 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(55,90,255,.22)]">Apply period</button>
          </div>
        )}

        {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-700 shadow-sm">{error}</div>}

        <section className="relative mb-4 overflow-hidden rounded-[32px] bg-[#0c1733] text-white shadow-[0_28px_70px_-32px_rgba(20,45,110,.6)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_12%,rgba(23,92,255,.48),transparent_28%),radial-gradient(circle_at_95%_10%,rgba(118,75,255,.45),transparent_31%),radial-gradient(circle_at_70%_95%,rgba(0,215,255,.24),transparent_30%)]" />
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:44px_44px]" />

          <div className="relative grid gap-6 px-5 py-6 sm:px-7 sm:py-7 xl:grid-cols-[1.12fr_.88fr] xl:items-stretch xl:px-8">
            <div className="flex min-h-[285px] flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.17em] text-blue-100 backdrop-blur-xl">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.9)]" /> Live business pulse
                  </span>
                  <span className="rounded-full bg-white/[.06] px-3 py-1.5 text-[9px] font-semibold text-white/60">{dashboardPeriodLabel(period)}</span>
                </div>

                <p className="mt-6 text-[10px] font-semibold uppercase tracking-[.2em] text-blue-200/55">Total collection opportunity</p>
                <p className="mt-2 text-[44px] font-[650] leading-none tracking-[-.055em] text-white sm:text-[58px] xl:text-[64px]">{money(totalReceivable)}</p>
                <p className="mt-3 max-w-xl text-[12px] leading-6 text-blue-100/55">Your complete receivable position — customers, ledgers and pending business — visible at a glance so the next action is always obvious.</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link href="/accounts/outstanding" className="group flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[11px] font-bold text-[#14264a] shadow-[0_10px_24px_rgba(0,0,0,.16)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(0,0,0,.2)]">
                  Collect now <Icon name="arrow" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </Link>
                <Link href="/accounts/cash-bank" className="rounded-xl border border-white/10 bg-white/[.07] px-4 py-2.5 text-[11px] font-semibold text-white backdrop-blur-xl transition hover:bg-white/[.12]">Receive / Pay</Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <HeroTile label="Customer due" value={money(customerReceivable)} note="Ready to collect" icon="wallet" tone="cyan" />
              <HeroTile label="Payable" value={money(payable)} note="Outgoing due" icon="credit" tone="rose" attention={payable > 0} />
              <HeroTile label="Commission" value={money(commissionDue)} note="Expected income" icon="rupee" tone="violet" />
              <HeroTile label="Company payment" value={money(companyPending.amount)} note={`${companyPending.count} pending`} icon="building" tone="amber" attention={companyPending.count > 0} />
            </div>
          </div>
        </section>

        <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PulseCard label="Active policies" value={num(policies)} helper="Currently protected" icon="shield" href="/insurance" tone="blue" />
          <PulseCard label="Renewals due" value={num(due)} helper={due > 0 ? "Follow-up today" : "All caught up"} icon="clock" href="/insurance" tone="rose" active={due > 0} />
          <PulseCard label="Open work" value={num(totalWork)} helper={totalWork > 0 ? "Tasks need attention" : "Queue is clear"} icon="building" href="#pending-work" tone="violet" active={totalWork > 0} />
          <PulseCard label="Vehicles" value={num(vehicles)} helper="Records managed" icon="vehicle" href="/vehicles" tone="cyan" />
        </section>

        {serviceDue > 0 && (
          <Link href="/accounts/outstanding" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-3.5 shadow-[0_10px_30px_rgba(200,130,30,.08)] dark:border-amber-900/50 dark:from-amber-950/30 dark:to-orange-950/20">
            <span className="flex items-center gap-2.5 text-[11px] font-bold text-amber-900 dark:text-amber-200"><span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/50"><Icon name="clock" className="h-3.5 w-3.5" /></span> Service collection needs attention</span>
            <span className="text-[13px] font-bold text-amber-800 dark:text-amber-300">{money(serviceDue)} →</span>
          </Link>
        )}

        <section className="mb-4 grid gap-4 xl:grid-cols-[1.28fr_.72fr]">
          <article id="pending-work" className="overflow-hidden rounded-[28px] border border-white/80 bg-white/80 shadow-[0_18px_50px_rgba(38,69,127,.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[.05]">
            <div className="flex items-end justify-between gap-4 border-b border-[#edf2fb] px-5 py-5 sm:px-6 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.2em] text-violet-500"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> Priority queue</div>
                <h2 className="mt-1.5 text-[22px] font-[650] tracking-[-.035em] text-[#17284a] dark:text-white">What needs your attention</h2>
                <p className="mt-1 text-[10px] text-[#93a0b7]">Focus on these first, then move to routine work.</p>
              </div>
              <div className="rounded-2xl bg-violet-50 px-4 py-3 text-right dark:bg-violet-950/30">
                <p className="text-[26px] font-[650] leading-none tracking-[-.04em] text-violet-700 dark:text-violet-300">{num(totalWork)}</p>
                <p className="mt-1 text-[8px] font-bold uppercase tracking-[.14em] text-violet-400">open items</p>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              {work.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {work.slice(0, 8).map(([label, value], index) => (
                    <Link key={label} href="/vehicles" className="group flex items-center gap-3 rounded-[18px] border border-transparent bg-[#f8faff] px-3.5 py-3 transition duration-200 hover:-translate-y-0.5 hover:border-[#dfe8fb] hover:bg-white hover:shadow-[0_10px_24px_rgba(48,75,130,.08)] dark:bg-white/[.035] dark:hover:border-white/10 dark:hover:bg-white/[.07]">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] ${index % 4 === 0 ? "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300" : index % 4 === 1 ? "bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300" : index % 4 === 2 ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>
                        <Icon name={index % 2 === 0 ? "clock" : "building"} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold capitalize text-[#2a3b5f] dark:text-white">{label.replaceAll("_", " ")}</span>
                        <span className="mt-0.5 block text-[9px] font-medium text-[#9aa6ba]">Needs follow-up</span>
                      </span>
                      <span className="grid h-8 min-w-8 place-items-center rounded-xl bg-white px-2 text-[11px] font-bold tabular-nums text-[#42567d] shadow-sm ring-1 ring-[#edf1f7] transition group-hover:bg-[#17284a] group-hover:text-white dark:bg-white/10 dark:text-white dark:ring-white/10">{value}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-56 place-items-center text-center">
                  <div>
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-100 to-cyan-100 text-emerald-600 shadow-sm dark:from-emerald-950/50 dark:to-cyan-950/50 dark:text-emerald-300"><Icon name="shield" className="h-6 w-6" /></div>
                    <p className="mt-4 text-[14px] font-bold text-[#29405f] dark:text-white">Everything is under control</p>
                    <p className="mt-1 text-[10px] text-[#9aa6b8]">No pending work needs attention in this period.</p>
                  </div>
                </div>
              )}
            </div>
          </article>

          <aside className="rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_18px_50px_rgba(38,69,127,.08)] backdrop-blur-xl sm:p-6 dark:border-white/10 dark:bg-white/[.05]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.2em] text-cyan-600"><span className="h-1.5 w-1.5 rounded-full bg-cyan-500" /> Money flow</div>
                <h2 className="mt-1.5 text-[21px] font-[650] tracking-[-.035em] text-[#17284a] dark:text-white">Financial control</h2>
                <p className="mt-1 text-[10px] text-[#98a5ba]">Know exactly where the money is.</p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-700 shadow-sm dark:from-cyan-950/50 dark:to-blue-950/50 dark:text-cyan-300"><Icon name="wallet" className="h-5 w-5" /></span>
            </div>

            <div className="mt-5 space-y-2">
              <FinanceGlow label="Receivable" value={money(totalReceivable)} href="/accounts/outstanding" tone="cyan" />
              <FinanceGlow label="Payable" value={money(payable)} href="/accounts/outstanding" tone="rose" attention={payable > 0} />
              <FinanceGlow label="Commission due" value={money(commissionDue)} href="/reports/insurance-commission" tone="violet" />
              <FinanceGlow label="Company payments" value={money(companyPending.amount)} href="/insurance/company-payments" tone="amber" note={`${companyPending.count} pending`} attention={companyPending.count > 0} />
            </div>

            {otherReceivable > 0 && <p className="mt-4 rounded-xl bg-[#f6f9ff] px-3.5 py-3 text-[9px] leading-5 text-[#8492a8] dark:bg-white/[.04] dark:text-slate-400">Includes {money(otherReceivable)} in other ledger receivables.</p>}
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
          <article className="rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_18px_50px_rgba(38,69,127,.07)] backdrop-blur-xl sm:p-6 dark:border-white/10 dark:bg-white/[.05]">
            <SectionTitle eyebrow="Daily desk" title="Start something" copy="Your most-used actions, one click away." tone="blue" />
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {primaryActions.map(([label, desc, href, icon, tone]) => <ActionCard key={label} label={label} desc={desc} href={href} icon={icon} tone={tone} />)}
            </div>
          </article>

          <article className="rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_18px_50px_rgba(38,69,127,.07)] backdrop-blur-xl sm:p-6 dark:border-white/10 dark:bg-white/[.05]">
            <SectionTitle eyebrow="Workspace" title="Everything else" copy="Tools for the rest of your day." tone="violet" />
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {secondaryActions.map(([label, desc, href, icon, tone]) => <MiniAction key={label} label={label} desc={desc} href={href} icon={icon} tone={tone} />)}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

const toneMap = {
  blue: { icon: "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300", soft: "from-blue-500/15 to-indigo-500/5", dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-300" },
  cyan: { icon: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300", soft: "from-cyan-400/15 to-blue-500/5", dot: "bg-cyan-500", text: "text-cyan-700 dark:text-cyan-300" },
  violet: { icon: "bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300", soft: "from-violet-500/15 to-fuchsia-500/5", dot: "bg-violet-500", text: "text-violet-600 dark:text-violet-300" },
  emerald: { icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300", soft: "from-emerald-400/15 to-cyan-400/5", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  amber: { icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300", soft: "from-amber-400/15 to-orange-400/5", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
  rose: { icon: "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300", soft: "from-rose-400/15 to-orange-400/5", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-300" },
};

function HeroTile({ label, value, note, icon, tone, attention = false }: { label: string; value: string; note: string; icon: string; tone: keyof typeof toneMap; attention?: boolean }) {
  const t = toneMap[tone];
  return (
    <div className={`relative overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-br ${t.soft} p-4 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-white/20 sm:p-5`}>
      <div className="absolute inset-0 bg-white/[.045]" />
      <div className="relative flex h-full min-h-[112px] flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-[.14em] text-white/55">{label}</span>
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-white/80"><Icon name={icon} className="h-3.5 w-3.5" /></span>
        </div>
        <div>
          <p className="truncate text-[19px] font-[650] tracking-[-.035em] text-white sm:text-[22px]">{value}</p>
          <p className={`mt-1 flex items-center gap-1.5 text-[9px] font-medium ${attention ? "text-amber-200" : "text-white/40"}`}>{attention && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />}{note}</p>
        </div>
      </div>
    </div>
  );
}

function PulseCard({ label, value, helper, icon, href, tone, active = false }: { label: string; value: string; helper: string; icon: string; href: string; tone: keyof typeof toneMap; active?: boolean }) {
  const t = toneMap[tone];
  return (
    <Link href={href} className="group relative overflow-hidden rounded-[24px] border border-white/80 bg-white/80 p-5 shadow-[0_14px_38px_rgba(38,69,127,.07)] backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(38,69,127,.12)] dark:border-white/10 dark:bg-white/[.05]">
      <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${t.soft} blur-2xl transition group-hover:scale-125`} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#8d9bb2]">{label}</p>
          <p className="mt-3 text-[32px] font-[650] leading-none tracking-[-.05em] text-[#183056] dark:text-white">{value}</p>
          <p className={`mt-2 flex items-center gap-1.5 text-[9px] font-medium ${active ? t.text : "text-[#9eabbf]"}`}>{active && <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />}{helper}</p>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[15px] ${t.icon} transition group-hover:scale-105`}><Icon name={icon} className="h-4.5 w-4.5" /></span>
      </div>
    </Link>
  );
}

function FinanceGlow({ label, value, href, tone, note, attention = false }: { label: string; value: string; href: string; tone: keyof typeof toneMap; note?: string; attention?: boolean }) {
  const t = toneMap[tone];
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-[16px] bg-[#f7f9ff] px-3.5 py-3 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_20px_rgba(45,72,130,.08)] dark:bg-white/[.035] dark:hover:bg-white/[.07]">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${t.icon}`}><span className={`h-2 w-2 rounded-full ${t.dot}`} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold text-[#667792] dark:text-slate-300">{label}</span>
        {note && <span className="mt-0.5 block text-[8px] text-[#a0abc0]">{note}</span>}
      </span>
      <span className={`text-[11px] font-bold tabular-nums ${attention ? t.text : "text-[#30466d] dark:text-white"}`}>{value}</span>
    </Link>
  );
}

function ActionCard({ label, desc, href, icon, tone }: { label: string; desc: string; href: string; icon: string; tone: keyof typeof toneMap }) {
  const t = toneMap[tone];
  return (
    <Link href={href} className="group relative overflow-hidden rounded-[20px] border border-[#edf1f8] bg-[#fafcff] p-4 transition duration-200 hover:-translate-y-1 hover:border-transparent hover:bg-white hover:shadow-[0_14px_34px_rgba(42,70,130,.11)] dark:border-white/10 dark:bg-white/[.035] dark:hover:bg-white/[.07]">
      <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${t.soft} blur-2xl transition group-hover:scale-125`} />
      <div className="relative flex items-center gap-3.5">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[15px] ${t.icon} transition group-hover:scale-105`}><Icon name={icon} className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-bold text-[#253a60] dark:text-white">{label}</span>
          <span className="mt-1 block text-[9px] text-[#9ba7bb]">{desc}</span>
        </span>
        <Icon name="arrow" className="h-4 w-4 text-[#b5bfd0] transition group-hover:translate-x-1 group-hover:text-[#50668f]" />
      </div>
    </Link>
  );
}

function MiniAction({ label, desc, href, icon, tone }: { label: string; desc: string; href: string; icon: string; tone: keyof typeof toneMap }) {
  const t = toneMap[tone];
  return (
    <Link href={href} className="group rounded-[18px] border border-transparent p-3 transition hover:-translate-y-0.5 hover:border-[#e9eff9] hover:bg-[#f9fbff] dark:hover:border-white/10 dark:hover:bg-white/[.05]">
      <span className={`grid h-9 w-9 place-items-center rounded-[13px] ${t.icon} transition group-hover:scale-105`}><Icon name={icon} className="h-3.5 w-3.5" /></span>
      <span className="mt-2.5 block text-[10px] font-bold text-[#385077] dark:text-white">{label}</span>
      <span className="mt-0.5 block truncate text-[8px] text-[#a1aec2]">{desc}</span>
    </Link>
  );
}

function SectionTitle({ eyebrow, title, copy, tone }: { eyebrow: string; title: string; copy: string; tone: "blue" | "violet" }) {
  const dot = tone === "blue" ? "bg-blue-500" : "bg-violet-500";
  const text = tone === "blue" ? "text-blue-600" : "text-violet-600";
  return (
    <div>
      <div className={`flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.2em] ${text}`}><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{eyebrow}</div>
      <h2 className="mt-1.5 text-[20px] font-[650] tracking-[-.035em] text-[#17284a] dark:text-white">{title}</h2>
      <p className="mt-1 text-[9px] text-[#9aa7bb]">{copy}</p>
    </div>
  );
}
