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

type ActionItem = readonly [string, string, string, string];

const primaryActions: readonly ActionItem[] = [
  ["Motor policy", "Issue or renew", "/insurance/motor", "shield"],
  ["New customer", "Create profile", "/customers/new", "customers"],
  ["New vehicle", "Add RC / vehicle", "/vehicles/new", "vehicle"],
  ["Receive / Pay", "Cash & bank", "/accounts/cash-bank", "credit"],
];

const moreActions: readonly ActionItem[] = [
  ["Non-motor", "Property & business", "/insurance/non_motor", "shield"],
  ["Health", "Health insurance", "/insurance/health", "shield"],
  ["RTO work", "Vehicle services", "/vehicles", "building"],
  ["Outstanding", "Receivable / payable", "/accounts/outstanding", "wallet"],
  ["Accounts", "Daily accounts", "/accounts", "book"],
  ["Reports", "P&L and analytics", "/reports", "reports"],
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
    <main
      className="min-h-screen bg-[#f6f7f9] pb-12 text-[#172033] antialiased dark:bg-[#070a10] dark:text-slate-100"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}
    >
      <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              Vimawallah ERP
            </div>
            <h1 className="text-[34px] font-semibold leading-none tracking-[-.045em] text-[#101828] sm:text-[42px] dark:text-white">
              {clock.greeting}
            </h1>
            <p className="mt-2 text-[13px] font-medium text-slate-400">{clock.date} <span className="mx-1.5 text-slate-300">•</span> {clock.time} IST</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
              aria-label="Dashboard period"
              className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(16,24,40,.03)] outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              {DASHBOARD_PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button onClick={() => void refresh(true)} disabled={refreshing} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(16,24,40,.03)] transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <Link href="/reports" className="flex h-10 items-center rounded-xl bg-[#111827] px-4 text-[12px] font-semibold text-white shadow-[0_7px_18px_rgba(17,24,39,.16)] transition hover:bg-black dark:bg-white dark:text-slate-950">View reports</Link>
          </div>
        </header>

        {period === "custom" && (
          <div className="mb-5 grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto] dark:border-slate-800 dark:bg-slate-900">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-[#fafafa] px-3 text-xs font-medium outline-none dark:border-slate-700 dark:bg-slate-950" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-[#fafafa] px-3 text-xs font-medium outline-none dark:border-slate-700 dark:bg-slate-950" />
            <button onClick={() => void refresh(true)} className="h-10 rounded-xl bg-[#111827] px-5 text-xs font-semibold text-white">Apply</button>
          </div>
        )}

        {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

        <section className="relative mb-4 overflow-hidden rounded-[30px] bg-[#0b1220] text-white shadow-[0_20px_55px_-28px_rgba(15,23,42,.55)]">
          <div className="pointer-events-none absolute -right-24 -top-36 h-[420px] w-[420px] rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-[38%] h-44 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="relative grid gap-8 px-6 py-7 sm:px-8 sm:py-8 xl:grid-cols-[1.1fr_.9fr] xl:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">Collection position · {dashboardPeriodLabel(period)}</p>
              <p className="mt-3 text-[38px] font-medium leading-none tracking-[-.045em] sm:text-[48px]">{money(totalReceivable)}</p>
              <p className="mt-3 max-w-lg text-[13px] leading-6 text-slate-400">Total receivable across customer and ledger balances. Focus on collection, renewals and company payments from one place.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/accounts/outstanding" className="rounded-xl bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-950 transition hover:bg-slate-100">Open outstanding</Link>
                <Link href="/accounts/cash-bank" className="rounded-xl border border-white/10 bg-white/[.06] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-white/10">Receive / Pay</Link>
              </div>
            </div>

            <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[.045] backdrop-blur-sm">
              <HeroStat label="Customer due" value={money(customerReceivable)} />
              <HeroStat label="Payable" value={money(payable)} danger={payable > 0} />
              <HeroStat label="Commission due" value={money(commissionDue)} />
              <HeroStat label="Company payment" value={money(companyPending.amount)} note={`${companyPending.count} pending`} danger={companyPending.count > 0} />
            </div>
          </div>
        </section>

        <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active policies" value={num(policies)} helper="Currently active" icon="shield" href="/insurance" />
          <MetricCard label="Renewals due" value={num(due)} helper="Needs follow-up" icon="clock" href="/insurance" alert={due > 0} />
          <MetricCard label="Open work" value={num(totalWork)} helper="Pending queue" icon="building" href="#pending-work" alert={totalWork > 0} />
          <MetricCard label="Vehicles" value={num(vehicles)} helper="Total records" icon="vehicle" href="/vehicles" />
        </section>

        {serviceDue > 0 && (
          <Link href="/accounts/outstanding" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-[#fffaf0] px-5 py-3.5 dark:border-amber-900/50 dark:bg-amber-950/20">
            <span className="text-[12px] font-semibold text-amber-900 dark:text-amber-200">Service work payment pending from customers</span>
            <span className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">{money(serviceDue)} <span className="ml-1">→</span></span>
          </Link>
        )}

        <section className="mb-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
          <article id="pending-work" className="rounded-[26px] border border-slate-200/80 bg-white shadow-[0_8px_28px_rgba(15,23,42,.045)] dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-end justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Priority queue</p>
                <h2 className="mt-1 text-[21px] font-semibold tracking-[-.025em] text-slate-950 dark:text-white">Pending work</h2>
              </div>
              <div className="text-right">
                <p className="text-[24px] font-semibold tracking-[-.035em] text-slate-900 dark:text-white">{totalWork}</p>
                <p className="text-[10px] font-medium text-slate-400">open items</p>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              {work.length ? (
                <div className="grid gap-1.5 md:grid-cols-2">
                  {work.slice(0, 8).map(([label, value]) => (
                    <Link href="/vehicles" key={label} className="group flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-[#f7f8fa] dark:hover:bg-slate-800/60">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-[0_1px_2px_rgba(16,24,40,.03)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <Icon name="clock" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold capitalize text-slate-800 dark:text-slate-100">{label.replaceAll("_", " ")}</span>
                        <span className="mt-0.5 block text-[10px] font-medium text-slate-400">Needs follow-up</span>
                      </span>
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{value}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-56 place-items-center text-center">
                  <div>
                    <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30"><Icon name="shield" className="h-5 w-5" /></div>
                    <p className="mt-3 text-[14px] font-semibold text-slate-800 dark:text-white">Work queue clear</p>
                    <p className="mt-1 text-[11px] text-slate-400">Nothing needs attention in this period.</p>
                  </div>
                </div>
              )}
            </div>
          </article>

          <aside className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,.045)] sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Quick start</p>
            <h2 className="mt-1 text-[21px] font-semibold tracking-[-.025em] text-slate-950 dark:text-white">Daily actions</h2>
            <div className="mt-5 space-y-2">
              {primaryActions.map(([label, desc, href, icon]) => (
                <Link key={label} href={href} className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-[#fafafa] p-3.5 transition hover:border-slate-200 hover:bg-white hover:shadow-[0_8px_20px_rgba(15,23,42,.06)] dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,.08)] dark:bg-slate-800 dark:text-slate-200"><Icon name={icon} className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold text-slate-800 dark:text-white">{label}</span>
                    <span className="mt-0.5 block text-[10px] font-medium text-slate-400">{desc}</span>
                  </span>
                  <span className="text-sm text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500">→</span>
                </Link>
              ))}
            </div>
          </aside>
        </section>

        <section className="rounded-[26px] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_8px_28px_rgba(15,23,42,.04)] sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">More tools</p>
              <h2 className="mt-1 text-[18px] font-semibold tracking-[-.02em] text-slate-950 dark:text-white">Everything else, one click away</h2>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {moreActions.map(([label, desc, href, icon]) => (
              <Link key={label} href={href} className="group rounded-2xl border border-slate-100 px-3.5 py-3.5 transition hover:border-slate-200 hover:bg-[#fafafa] dark:border-slate-800 dark:hover:bg-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon name={icon} className="h-3.5 w-3.5" /></span>
                  <span className="text-[12px] font-semibold text-slate-800 dark:text-white">{label}</span>
                </div>
                <p className="mt-2 text-[10px] font-medium text-slate-400">{desc}</p>
              </Link>
            ))}
          </div>
          {otherReceivable > 0 && <p className="mt-4 text-[10px] font-medium text-slate-400">Other ledger receivable included in total: {money(otherReceivable)}</p>}
        </section>
      </div>
    </main>
  );
}

function HeroStat({ label, value, note, danger = false }: { label: string; value: string; note?: string; danger?: boolean }) {
  return (
    <div className="border-b border-r border-white/10 p-4 last:border-r-0 sm:p-5">
      <p className="text-[9px] font-semibold uppercase tracking-[.14em] text-slate-500">{label}</p>
      <p className={`mt-1.5 truncate text-[18px] font-medium tracking-[-.025em] ${danger ? "text-rose-200" : "text-white"}`}>{value}</p>
      {note && <p className={`mt-1 text-[9px] font-medium ${danger ? "text-rose-300/80" : "text-slate-500"}`}>{note}</p>}
    </div>
  );
}

function MetricCard({ label, value, helper, icon, href, alert = false }: { label: string; value: string; helper: string; icon: string; href: string; alert?: boolean }) {
  return (
    <Link href={href} className="group rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_6px_20px_rgba(15,23,42,.035)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,23,42,.07)] dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-slate-400">{label}</p>
          <p className="mt-2 text-[27px] font-semibold leading-none tracking-[-.04em] text-slate-950 dark:text-white">{value}</p>
          <p className={`mt-2 text-[10px] font-medium ${alert ? "text-amber-600 dark:text-amber-300" : "text-slate-400"}`}>{helper}</p>
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${alert ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
