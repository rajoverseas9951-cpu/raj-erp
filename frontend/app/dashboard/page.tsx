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
  ["Motor policy", "Issue or renew policy", "/insurance/motor", "shield"],
  ["New customer", "Create customer profile", "/customers/new", "customers"],
  ["New vehicle", "Add RC and vehicle", "/vehicles/new", "vehicle"],
  ["Receive / Pay", "Record cash or bank", "/accounts/cash-bank", "credit"],
];

const secondaryActions: readonly ActionItem[] = [
  ["Non-motor", "Property & business", "/insurance/non_motor", "shield"],
  ["Health", "Health insurance", "/insurance/health", "shield"],
  ["RTO work", "Vehicle services", "/vehicles", "building"],
  ["Outstanding", "Receivable & payable", "/accounts/outstanding", "wallet"],
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
      const checks = await Promise.all(
        active.map(async (p) => {
          try {
            const settlement = await authenticatedRequest<SettlementInfo>(`/vehicles/${p.vehicle_id}/insurances/${p.id}/settlement`);
            return settlement.settlement ? null : p;
          } catch {
            return p;
          }
        }),
      );
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
    try {
      setBalances(await financeControlApi.outstanding());
    } catch {
      setBalances(null);
    }
  }, []);

  const refresh = useCallback(
    (forceCompany = false) => {
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
    },
    [period, dateFrom, dateTo, refreshCompanyPayments, refreshBalances],
  );

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

  const work = Object.entries(data?.work ?? {})
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalWork = work.reduce((sum, [, value]) => sum + value, 0);
  const vehicles = data?.kpis.vehicles?.value ?? 0;
  const policies = data?.kpis.active_policies?.value ?? 0;
  const due = data?.kpis.expiring_policies?.value ?? 0;
  const customerReceivable = Number(
    balances?.summary.customer_receivable ?? data?.kpis.outstanding_amount?.value ?? data?.revenue.outstanding ?? 0,
  );
  const otherReceivable = Number(balances?.summary.ledger_receivable ?? 0);
  const totalReceivable = Number(balances?.summary.total_receivable ?? customerReceivable + otherReceivable);
  const payable = Number(balances?.summary.party_payable ?? 0);
  const commissionDue = Number(balances?.summary.insurance_commission_due ?? 0);
  const serviceDue = Number(balances?.summary.service_customer_due ?? 0);

  return (
    <main
      className="min-h-screen bg-[#f3f5f7] pb-14 text-[#111827] antialiased dark:bg-[#06090f] dark:text-slate-100"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}
    >
      <div className="mx-auto max-w-[1510px] px-4 py-6 sm:px-6 lg:px-9 lg:py-8">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[.22em] text-[#788399]">
              <span className="h-[7px] w-[7px] rounded-full bg-[#315bd6] shadow-[0_0_0_4px_rgba(49,91,214,.08)]" />
              Vimawallah · Executive desk
            </div>
            <h1 className="text-[36px] font-[560] leading-[.96] tracking-[-.05em] text-[#0d1420] sm:text-[46px] dark:text-white">
              {clock.greeting}
            </h1>
            <p className="mt-3 text-[12px] font-medium tracking-[.01em] text-[#8a94a6]">
              {clock.date} <span className="mx-2 text-[#c8ced8]">/</span> {clock.time} IST
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/80 bg-white/70 p-1.5 shadow-[0_8px_30px_rgba(16,24,40,.05)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
              aria-label="Dashboard period"
              className="h-9 min-w-36 rounded-xl border-0 bg-transparent px-3 text-[11px] font-semibold text-[#48536a] outline-none dark:text-slate-200"
            >
              {DASHBOARD_PERIODS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <span className="hidden h-5 w-px bg-slate-200 sm:block dark:bg-slate-700" />
            <button
              onClick={() => void refresh(true)}
              disabled={refreshing}
              className="h-9 rounded-xl px-3.5 text-[11px] font-semibold text-[#596579] transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <Link
              href="/reports"
              className="flex h-9 items-center rounded-xl bg-[#101828] px-4 text-[11px] font-semibold text-white shadow-[0_7px_18px_rgba(16,24,40,.14)] transition hover:bg-black dark:bg-white dark:text-slate-950"
            >
              Reports
            </Link>
          </div>
        </header>

        {period === "custom" && (
          <div className="mb-5 grid gap-2 rounded-2xl border border-white bg-white/75 p-2.5 shadow-[0_8px_24px_rgba(16,24,40,.04)] backdrop-blur-xl sm:grid-cols-[1fr_1fr_auto] dark:border-slate-800 dark:bg-slate-900/75">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none dark:border-slate-700 dark:bg-slate-950" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none dark:border-slate-700 dark:bg-slate-950" />
            <button onClick={() => void refresh(true)} className="h-10 rounded-xl bg-[#101828] px-5 text-xs font-semibold text-white">Apply period</button>
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        <section className="relative mb-5 overflow-hidden rounded-[34px] border border-white/10 bg-[#09101d] text-white shadow-[0_32px_80px_-42px_rgba(4,12,28,.82)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_5%,rgba(48,94,220,.25),transparent_31%),radial-gradient(circle_at_0%_100%,rgba(181,145,72,.10),transparent_33%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          <div className="relative grid min-h-[315px] xl:grid-cols-[1.08fr_.92fr]">
            <div className="flex flex-col justify-between px-6 py-7 sm:px-9 sm:py-9 lg:px-11 lg:py-10">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[.24em] text-[#909bb0]">Net collection position</p>
                  <span className="rounded-full border border-[#c9a868]/20 bg-[#c9a868]/10 px-2.5 py-1 text-[9px] font-semibold tracking-wide text-[#e1c58f]">
                    {dashboardPeriodLabel(period)}
                  </span>
                </div>
                <p className="mt-5 text-[42px] font-[520] leading-none tracking-[-.055em] text-white sm:text-[58px] xl:text-[64px]">
                  {money(totalReceivable)}
                </p>
                <p className="mt-4 max-w-xl text-[12px] leading-6 text-[#8d99ae] sm:text-[13px]">
                  Total amount currently collectible across customer and ledger balances. Prioritise renewals, outstanding recovery and pending insurer settlements from this desk.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-2.5">
                <Link href="/accounts/outstanding" className="rounded-xl bg-white px-4 py-2.5 text-[11px] font-semibold text-[#101828] transition hover:bg-[#f4f5f7]">
                  Review collections
                </Link>
                <Link href="/accounts/cash-bank" className="rounded-xl border border-white/10 bg-white/[.055] px-4 py-2.5 text-[11px] font-semibold text-white transition hover:bg-white/10">
                  Receive / Pay
                </Link>
              </div>
            </div>

            <div className="border-t border-white/[.07] bg-white/[.025] p-4 sm:p-5 xl:border-l xl:border-t-0 xl:p-6">
              <div className="grid h-full grid-cols-2 gap-px overflow-hidden rounded-[24px] bg-white/[.08]">
                <HeroStat label="Customer due" value={money(customerReceivable)} note="Collection" />
                <HeroStat label="Payable" value={money(payable)} note="To parties" danger={payable > 0} />
                <HeroStat label="Commission due" value={money(commissionDue)} note="Expected income" />
                <HeroStat label="Company payment" value={money(companyPending.amount)} note={`${companyPending.count} pending`} danger={companyPending.count > 0} />
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active policies" value={num(policies)} helper="In force" icon="shield" href="/insurance" />
          <MetricCard label="Renewals due" value={num(due)} helper="Follow-up required" icon="clock" href="/insurance" alert={due > 0} />
          <MetricCard label="Open work" value={num(totalWork)} helper="Current queue" icon="building" href="#pending-work" alert={totalWork > 0} />
          <MetricCard label="Vehicles" value={num(vehicles)} helper="Records managed" icon="vehicle" href="/vehicles" />
        </section>

        {serviceDue > 0 && (
          <Link href="/accounts/outstanding" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e8d7ac] bg-[#fffaf0] px-5 py-3.5 shadow-[0_4px_16px_rgba(110,83,25,.04)] dark:border-amber-900/50 dark:bg-amber-950/20">
            <span className="text-[11px] font-semibold tracking-wide text-[#785d23] dark:text-amber-200">SERVICE COLLECTION PENDING</span>
            <span className="text-[13px] font-semibold text-[#6d5421] dark:text-amber-300">{money(serviceDue)} <span className="ml-1">→</span></span>
          </Link>
        )}

        <section className="mb-5 grid gap-4 xl:grid-cols-[1.42fr_.58fr]">
          <article id="pending-work" className="overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_18px_50px_rgba(16,24,40,.055)] dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-end justify-between gap-5 px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[.22em] text-[#8792a5]">Priority queue</p>
                <h2 className="mt-1.5 text-[22px] font-[560] tracking-[-.035em] text-[#111827] dark:text-white">Work requiring attention</h2>
              </div>
              <div className="text-right">
                <p className="text-[30px] font-[520] leading-none tracking-[-.045em] text-[#15203a] dark:text-white">{num(totalWork)}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[.15em] text-[#9aa3b2]">open items</p>
              </div>
            </div>

            <div className="border-t border-slate-100 px-3 py-3 sm:px-4 sm:py-4 dark:border-slate-800">
              {work.length ? (
                <div className="grid gap-1.5 md:grid-cols-2">
                  {work.slice(0, 8).map(([label, value], index) => (
                    <Link
                      href="/vehicles"
                      key={label}
                      className="group grid grid-cols-[38px_1fr_auto] items-center gap-3 rounded-[17px] px-3 py-3 transition hover:bg-[#f6f8fb] dark:hover:bg-slate-800/70"
                    >
                      <span className={`grid h-9 w-9 place-items-center rounded-xl ${index === 0 ? "bg-[#15203a] text-white" : "bg-[#f2f5f9] text-[#53647c] dark:bg-slate-800 dark:text-slate-300"}`}>
                        <Icon name={index % 2 === 0 ? "clock" : "building"} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-semibold capitalize text-[#263145] dark:text-white">{label.replaceAll("_", " ")}</span>
                        <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[.08em] text-[#9ba5b4]">Follow-up</span>
                      </span>
                      <span className="rounded-lg bg-[#f0f3f8] px-2.5 py-1.5 text-[12px] font-semibold tabular-nums text-[#344258] transition group-hover:bg-white dark:bg-slate-800 dark:text-slate-200">{value}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-60 place-items-center text-center">
                  <div>
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
                      <Icon name="shield" className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-[14px] font-semibold text-[#273247] dark:text-white">Queue is clear</p>
                    <p className="mt-1 text-[11px] text-[#9aa3b2]">No open work needs attention for this period.</p>
                  </div>
                </div>
              )}
            </div>
          </article>

          <aside className="rounded-[28px] border border-white bg-white p-5 shadow-[0_18px_50px_rgba(16,24,40,.055)] sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[.22em] text-[#8792a5]">Financial control</p>
                <h2 className="mt-1.5 text-[20px] font-[560] tracking-[-.035em] text-[#111827] dark:text-white">Money movement</h2>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f3f5f8] text-[#40516d] dark:bg-slate-800 dark:text-slate-300">
                <Icon name="wallet" className="h-4 w-4" />
              </span>
            </div>

            <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
              <FinanceRow label="Receivable" value={money(totalReceivable)} href="/accounts/outstanding" />
              <FinanceRow label="Payable" value={money(payable)} href="/accounts/outstanding" danger={payable > 0} />
              <FinanceRow label="Commission due" value={money(commissionDue)} href="/reports/insurance-commission" />
              <FinanceRow label="Company payments" value={money(companyPending.amount)} href="/insurance/company-payments" danger={companyPending.count > 0} note={`${companyPending.count} pending`} />
            </div>

            {otherReceivable > 0 && (
              <p className="mt-4 rounded-xl bg-[#f7f8fa] px-3.5 py-3 text-[10px] leading-5 text-[#7d8798] dark:bg-slate-950/40 dark:text-slate-400">
                Includes {money(otherReceivable)} in other ledger receivables.
              </p>
            )}
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.03fr_.97fr]">
          <article className="rounded-[28px] border border-white bg-white p-5 shadow-[0_16px_44px_rgba(16,24,40,.045)] sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <SectionHeading eyebrow="Daily desk" title="Start a task" />
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {primaryActions.map(([label, desc, href, icon], index) => (
                <Link key={label} href={href} className="group flex min-h-[74px] items-center gap-3.5 rounded-[18px] border border-[#edf0f4] bg-[#fafbfc] px-4 py-3 transition hover:border-[#d9e0ea] hover:bg-white hover:shadow-[0_8px_24px_rgba(16,24,40,.055)] dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] ${index === 0 ? "bg-[#14213a] text-white shadow-[0_7px_18px_rgba(20,33,58,.18)]" : "bg-white text-[#4e607a] ring-1 ring-[#e8ecf1] dark:bg-slate-900 dark:ring-slate-700"}`}>
                    <Icon name={icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold text-[#273247] dark:text-white">{label}</span>
                    <span className="mt-1 block text-[10px] text-[#98a1b0]">{desc}</span>
                  </span>
                  <span className="text-[15px] text-[#bec5cf] transition group-hover:translate-x-0.5 group-hover:text-[#59677c]">→</span>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-[28px] border border-white bg-white p-5 shadow-[0_16px_44px_rgba(16,24,40,.045)] sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <SectionHeading eyebrow="Workspace" title="More tools" />
            <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
              {secondaryActions.map(([label, desc, href, icon]) => (
                <Link key={label} href={href} className="group rounded-[17px] px-3 py-3 transition hover:bg-[#f6f8fa] dark:hover:bg-slate-800/70">
                  <span className="grid h-8 w-8 place-items-center rounded-[11px] bg-[#f1f4f7] text-[#62718a] transition group-hover:bg-white group-hover:shadow-sm dark:bg-slate-800 dark:text-slate-300">
                    <Icon name={icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="mt-2.5 block text-[11px] font-semibold text-[#344056] dark:text-white">{label}</span>
                  <span className="mt-0.5 block truncate text-[9px] text-[#9aa3b2]">{desc}</span>
                </Link>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function HeroStat({ label, value, note, danger = false }: { label: string; value: string; note?: string; danger?: boolean }) {
  return (
    <div className="flex min-h-[126px] flex-col justify-between bg-[#0d1524]/90 p-4.5 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-[.16em] text-[#8591a7]">{label}</span>
        {danger && <span className="h-1.5 w-1.5 rounded-full bg-[#d9a55b] shadow-[0_0_0_4px_rgba(217,165,91,.08)]" />}
      </div>
      <div>
        <p className={`truncate text-[19px] font-[540] tracking-[-.035em] sm:text-[22px] ${danger ? "text-[#f0d2a0]" : "text-white"}`}>{value}</p>
        {note && <p className="mt-1 text-[9px] font-medium text-[#69768e]">{note}</p>}
      </div>
    </div>
  );
}

function MetricCard({ label, value, helper, icon, href, alert = false }: { label: string; value: string; helper: string; icon: string; href: string; alert?: boolean }) {
  return (
    <Link href={href} className="group relative overflow-hidden rounded-[24px] border border-white bg-white p-5 shadow-[0_13px_36px_rgba(16,24,40,.045)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(16,24,40,.07)] dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[.17em] text-[#929cac]">{label}</p>
          <p className="mt-3 text-[30px] font-[540] leading-none tracking-[-.05em] text-[#15203a] dark:text-white">{value}</p>
          <p className={`mt-2 text-[10px] font-medium ${alert ? "text-[#b0792f]" : "text-[#9ca5b3]"}`}>{helper}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${alert ? "bg-[#fff6e7] text-[#a7702d] dark:bg-amber-950/30" : "bg-[#f2f5f8] text-[#52637d] dark:bg-slate-800 dark:text-slate-300"}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <span className="pointer-events-none absolute inset-x-5 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-[#315bd6] to-transparent transition-transform duration-300 group-hover:scale-x-100" />
    </Link>
  );
}

function FinanceRow({ label, value, href, danger = false, note }: { label: string; value: string; href: string; danger?: boolean; note?: string }) {
  return (
    <Link href={href} className="group flex items-center justify-between gap-4 py-3.5">
      <span>
        <span className="block text-[11px] font-medium text-[#697487] dark:text-slate-300">{label}</span>
        {note && <span className="mt-0.5 block text-[9px] text-[#a1a9b6]">{note}</span>}
      </span>
      <span className={`text-[12px] font-semibold tabular-nums ${danger ? "text-[#a86e2b]" : "text-[#26334b] dark:text-white"}`}>{value}</span>
    </Link>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-[.22em] text-[#909aab]">{eyebrow}</p>
      <h2 className="mt-1.5 text-[19px] font-[560] tracking-[-.03em] text-[#15203a] dark:text-white">{title}</h2>
    </div>
  );
}
