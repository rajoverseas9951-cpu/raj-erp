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
type ActionItem = readonly [string, string, string, string];

const primaryActions: readonly ActionItem[] = [
  ["Motor policy", "Issue or renew", "/insurance/motor", "shield"],
  ["New customer", "Create profile", "/customers/new", "customers"],
  ["New vehicle", "Add RC / vehicle", "/vehicles/new", "vehicle"],
  ["Receive / Pay", "Cash & bank", "/accounts/cash-bank", "credit"],
];

const secondaryActions: readonly ActionItem[] = [
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
      className="min-h-screen bg-[#f7f8fa] pb-12 text-[#0f1728] antialiased dark:bg-[#080b11] dark:text-slate-100"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}
    >
      <div className="mx-auto max-w-[1460px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-[.02em] text-[#7c879a]">Vimawallah ERP</p>
            <h1 className="mt-2 text-[38px] font-[540] leading-none tracking-[-.055em] text-[#111827] sm:text-[48px] dark:text-white">
              {clock.greeting}
            </h1>
            <p className="mt-3 text-[12px] font-medium text-[#98a1b0]">{clock.date} · {clock.time} IST</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
              className="h-10 min-w-40 rounded-xl border border-[#e2e6ec] bg-white px-3.5 text-[12px] font-medium text-[#4a5568] outline-none transition focus:border-[#aab4c3] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              aria-label="Dashboard period"
            >
              {DASHBOARD_PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button
              onClick={() => void refresh(true)}
              disabled={refreshing}
              className="h-10 rounded-xl border border-[#e2e6ec] bg-white px-4 text-[12px] font-medium text-[#4a5568] transition hover:bg-[#fafbfc] disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <Link href="/reports" className="flex h-10 items-center rounded-xl bg-[#111827] px-4 text-[12px] font-semibold text-white transition hover:bg-[#020617] dark:bg-white dark:text-[#111827]">
              Reports
            </Link>
          </div>
        </header>

        {period === "custom" && (
          <div className="mb-5 grid gap-2 rounded-2xl border border-[#e5e9ef] bg-white p-3 sm:grid-cols-[1fr_1fr_auto] dark:border-slate-800 dark:bg-slate-900">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-xl border border-[#e2e6ec] bg-[#fbfcfd] px-3 text-xs font-medium outline-none dark:border-slate-700 dark:bg-slate-950" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-xl border border-[#e2e6ec] bg-[#fbfcfd] px-3 text-xs font-medium outline-none dark:border-slate-700 dark:bg-slate-950" />
            <button onClick={() => void refresh(true)} className="h-10 rounded-xl bg-[#111827] px-5 text-xs font-semibold text-white">Apply</button>
          </div>
        )}

        {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

        <section className="mb-5 overflow-hidden rounded-[26px] border border-[#e3e7ed] bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="grid lg:grid-cols-[1.05fr_.95fr]">
            <div className="px-6 py-7 sm:px-8 sm:py-8 lg:px-9">
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#8791a2]">Collection position</p>
                <span className="rounded-full bg-[#f1f4f8] px-2.5 py-1 text-[10px] font-medium text-[#667085] dark:bg-slate-800 dark:text-slate-300">{dashboardPeriodLabel(period)}</span>
              </div>
              <p className="mt-4 text-[46px] font-[520] leading-none tracking-[-.06em] text-[#111827] sm:text-[60px] dark:text-white">{money(totalReceivable)}</p>
              <p className="mt-4 max-w-xl text-[12px] leading-6 text-[#8a94a5]">Total collectible amount across customer and ledger balances.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/accounts/outstanding" className="rounded-xl bg-[#111827] px-4 py-2.5 text-[11px] font-semibold text-white transition hover:bg-black">Open outstanding</Link>
                <Link href="/accounts/cash-bank" className="rounded-xl border border-[#e2e6ec] bg-white px-4 py-2.5 text-[11px] font-semibold text-[#4b5565] transition hover:bg-[#fafbfc] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Receive / Pay</Link>
              </div>
            </div>

            <div className="grid grid-cols-2 border-t border-[#edf0f3] lg:border-l lg:border-t-0 dark:border-slate-800">
              <SummaryCell label="Customer due" value={money(customerReceivable)} />
              <SummaryCell label="Payable" value={money(payable)} danger={payable > 0} />
              <SummaryCell label="Commission due" value={money(commissionDue)} />
              <SummaryCell label="Company payment" value={money(companyPending.amount)} note={`${companyPending.count} pending`} danger={companyPending.count > 0} />
            </div>
          </div>
        </section>

        <section className="mb-5 grid gap-px overflow-hidden rounded-[22px] border border-[#e3e7ed] bg-[#e3e7ed] sm:grid-cols-2 xl:grid-cols-4 dark:border-slate-800 dark:bg-slate-800">
          <MetricStrip label="Active policies" value={num(policies)} helper="In force" icon="shield" href="/insurance" />
          <MetricStrip label="Renewals due" value={num(due)} helper="Follow-up" icon="clock" href="/insurance" alert={due > 0} />
          <MetricStrip label="Open work" value={num(totalWork)} helper="Pending queue" icon="building" href="#pending-work" alert={totalWork > 0} />
          <MetricStrip label="Vehicles" value={num(vehicles)} helper="Managed records" icon="vehicle" href="/vehicles" />
        </section>

        {serviceDue > 0 && (
          <Link href="/accounts/outstanding" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
            <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">Service collection pending</span>
            <span className="text-[12px] font-semibold text-amber-800 dark:text-amber-300">{money(serviceDue)} →</span>
          </Link>
        )}

        <section className="mb-5 grid gap-5 xl:grid-cols-[1.45fr_.55fr]">
          <article id="pending-work" className="rounded-[24px] border border-[#e3e7ed] bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-end justify-between gap-4 border-b border-[#edf0f3] px-5 py-5 sm:px-6 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-medium text-[#9099a8]">Priority queue</p>
                <h2 className="mt-1 text-[21px] font-[550] tracking-[-.035em] text-[#1a2232] dark:text-white">Work requiring attention</h2>
              </div>
              <div className="text-right">
                <p className="text-[28px] font-[520] leading-none tracking-[-.04em] text-[#1d2939] dark:text-white">{num(totalWork)}</p>
                <p className="mt-1 text-[9px] font-medium uppercase tracking-[.12em] text-[#9da6b4]">open</p>
              </div>
            </div>

            <div className="p-2 sm:p-3">
              {work.length ? (
                <div className="grid md:grid-cols-2">
                  {work.slice(0, 8).map(([label, value]) => (
                    <Link href="/vehicles" key={label} className="group grid grid-cols-[34px_1fr_auto] items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#f7f9fb] dark:hover:bg-slate-800/70">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f1f4f7] text-[#5f6b7c] dark:bg-slate-800 dark:text-slate-300"><Icon name="clock" className="h-3.5 w-3.5" /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-medium capitalize text-[#344054] dark:text-white">{label.replaceAll("_", " ")}</span>
                        <span className="mt-0.5 block text-[9px] text-[#a0a8b5]">Needs follow-up</span>
                      </span>
                      <span className="text-[13px] font-semibold tabular-nums text-[#475467] dark:text-slate-200">{value}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-52 place-items-center text-center">
                  <div>
                    <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40"><Icon name="shield" className="h-4 w-4" /></div>
                    <p className="mt-3 text-[13px] font-medium text-[#344054] dark:text-white">Queue is clear</p>
                    <p className="mt-1 text-[10px] text-[#98a2b3]">Nothing needs attention in this period.</p>
                  </div>
                </div>
              )}
            </div>
          </article>

          <aside className="rounded-[24px] bg-[#111827] p-5 text-white sm:p-6 dark:bg-[#10141d]">
            <p className="text-[10px] font-medium text-[#98a2b3]">Financial control</p>
            <h2 className="mt-1 text-[20px] font-[520] tracking-[-.035em]">Money movement</h2>
            <div className="mt-5 divide-y divide-white/10">
              <DarkFinanceRow label="Receivable" value={money(totalReceivable)} href="/accounts/outstanding" />
              <DarkFinanceRow label="Payable" value={money(payable)} href="/accounts/outstanding" danger={payable > 0} />
              <DarkFinanceRow label="Commission due" value={money(commissionDue)} href="/reports/insurance-commission" />
              <DarkFinanceRow label="Company payments" value={money(companyPending.amount)} href="/insurance/company-payments" danger={companyPending.count > 0} note={`${companyPending.count} pending`} />
            </div>
            {otherReceivable > 0 && <p className="mt-4 text-[9px] leading-5 text-[#7f8a9c]">Includes {money(otherReceivable)} other ledger receivable.</p>}
          </aside>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
          <article className="rounded-[24px] border border-[#e3e7ed] bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <SectionHeading eyebrow="Daily desk" title="Start a task" />
            <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-[#e8ebef] bg-[#e8ebef] sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-800">
              {primaryActions.map(([label, desc, href, icon]) => (
                <Link key={label} href={href} className="group flex items-center gap-3 bg-white px-4 py-4 transition hover:bg-[#f8fafc] dark:bg-slate-900 dark:hover:bg-slate-800">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f1f4f7] text-[#556274] dark:bg-slate-800 dark:text-slate-300"><Icon name={icon} className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium text-[#344054] dark:text-white">{label}</span>
                    <span className="mt-0.5 block text-[9px] text-[#9aa3b2]">{desc}</span>
                  </span>
                  <span className="text-[#b1b8c3] transition group-hover:translate-x-0.5 group-hover:text-[#667085]">→</span>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-[24px] border border-[#e3e7ed] bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <SectionHeading eyebrow="Workspace" title="More tools" />
            <div className="mt-4 grid grid-cols-2 gap-1 sm:grid-cols-3">
              {secondaryActions.map(([label, desc, href, icon]) => (
                <Link key={label} href={href} className="group rounded-xl px-3 py-3 transition hover:bg-[#f7f9fb] dark:hover:bg-slate-800/70">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f1f4f7] text-[#637084] dark:bg-slate-800 dark:text-slate-300"><Icon name={icon} className="h-3.5 w-3.5" /></span>
                  <span className="mt-2 block text-[11px] font-medium text-[#475467] dark:text-white">{label}</span>
                  <span className="mt-0.5 block truncate text-[9px] text-[#a0a8b5]">{desc}</span>
                </Link>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function SummaryCell({ label, value, note, danger = false }: { label: string; value: string; note?: string; danger?: boolean }) {
  return (
    <div className="min-h-[118px] border-b border-r border-[#edf0f3] p-5 last:border-r-0 dark:border-slate-800">
      <p className="text-[10px] font-medium text-[#98a2b3]">{label}</p>
      <p className={`mt-3 truncate text-[20px] font-[520] tracking-[-.035em] ${danger ? "text-[#b54708]" : "text-[#1d2939] dark:text-white"}`}>{value}</p>
      {note && <p className="mt-1 text-[9px] text-[#a7afbb]">{note}</p>}
    </div>
  );
}

function MetricStrip({ label, value, helper, icon, href, alert = false }: { label: string; value: string; helper: string; icon: string; href: string; alert?: boolean }) {
  return (
    <Link href={href} className="group flex items-center justify-between gap-4 bg-white px-5 py-4 transition hover:bg-[#fbfcfd] dark:bg-slate-900 dark:hover:bg-slate-800">
      <div>
        <p className="text-[10px] font-medium text-[#98a2b3]">{label}</p>
        <div className="mt-1.5 flex items-end gap-2">
          <p className="text-[25px] font-[520] leading-none tracking-[-.045em] text-[#1d2939] dark:text-white">{value}</p>
          <span className={`pb-0.5 text-[9px] ${alert ? "font-semibold text-[#b54708]" : "text-[#a0a8b5]"}`}>{helper}</span>
        </div>
      </div>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f2f4f7] text-[#667085] transition group-hover:bg-white dark:bg-slate-800 dark:text-slate-300"><Icon name={icon} className="h-4 w-4" /></span>
    </Link>
  );
}

function DarkFinanceRow({ label, value, href, danger = false, note }: { label: string; value: string; href: string; danger?: boolean; note?: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-4 py-3.5">
      <span>
        <span className="block text-[11px] font-medium text-[#a4adbb]">{label}</span>
        {note && <span className="mt-0.5 block text-[9px] text-[#687386]">{note}</span>}
      </span>
      <span className={`text-[12px] font-semibold tabular-nums ${danger ? "text-[#f6b26b]" : "text-white"}`}>{value}</span>
    </Link>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-[#98a2b3]">{eyebrow}</p>
      <h2 className="mt-1 text-[19px] font-[540] tracking-[-.03em] text-[#1d2939] dark:text-white">{title}</h2>
    </div>
  );
}
