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

const workActions = [
  ["New Vehicle", "Add vehicle / RC", "/vehicles/new", "vehicle"],
  ["New Customer", "Create customer", "/customers/new", "customers"],
  ["Motor Insurance", "Create motor policy", "/insurance/motor", "shield"],
  ["Non-Motor", "Property & business", "/insurance/non_motor", "shield"],
  ["Health", "Health insurance", "/insurance/health", "shield"],
  ["RTO Work", "Vehicle services", "/vehicles", "building"],
] as const;

const moneyActions = [
  ["Receive / Pay", "Cash & bank entry", "/accounts/cash-bank", "credit"],
  ["Outstanding", "Receivable / payable", "/accounts/outstanding", "wallet"],
  ["Accounts", "Daily accounts", "/accounts", "book"],
  ["Reports", "P&L and business reports", "/reports", "reports"],
] as const;

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
    <main className="min-h-screen bg-[#f4f7fb] pb-10 dark:bg-[#050914]">
      <div className="mx-auto max-w-[1500px] space-y-4 p-4 sm:p-6 lg:p-7">
        <section className="relative overflow-hidden rounded-[26px] bg-[#071a3c] text-white shadow-[0_24px_65px_-34px_rgba(7,26,60,.8)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(42,112,255,.45),transparent_30%),linear-gradient(115deg,#06142e_0%,#09265b_62%,#1147b9_100%)]" />
          <div className="relative flex flex-col gap-5 px-5 py-5 sm:px-7 sm:py-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.24em] text-cyan-200">Vimawallah ERP · Command Center</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-[38px]">{clock.greeting}</h1>
              <p className="mt-1 text-sm font-bold text-blue-100/70">{clock.date} · {clock.time} IST</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div>
                <label className="mb-1 block text-[9px] font-black uppercase tracking-[.16em] text-blue-100/55">Period</label>
                <select value={period} onChange={(e) => setPeriod(e.target.value as DashboardPeriod)} className="min-w-40 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-black text-white outline-none [color-scheme:dark]">
                  {DASHBOARD_PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <button onClick={() => void refresh(true)} disabled={refreshing} className="rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#0b2b62] transition hover:bg-blue-50 disabled:opacity-60">
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
              <Link href="/reports" className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-center text-xs font-black text-white transition hover:bg-white/15">Reports →</Link>
            </div>
          </div>
          {period === "custom" && (
            <div className="relative grid gap-2 border-t border-white/10 bg-black/10 px-5 py-3 sm:grid-cols-[1fr_1fr_auto] sm:px-7">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold text-white [color-scheme:dark]" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold text-white [color-scheme:dark]" />
              <button onClick={() => void refresh(true)} className="rounded-xl bg-blue-500 px-4 py-2.5 text-xs font-black text-white">Apply dates</button>
            </div>
          )}
        </section>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Vehicles" value={num(vehicles)} icon="vehicle" href="/vehicles" />
          <KpiCard label="Active Policies" value={num(policies)} icon="shield" href="/insurance" />
          <KpiCard label="Renewal Due" value={num(due)} icon="clock" href="/insurance" alert={due > 0} />
          <KpiCard label="Customer Due" value={money(customerReceivable)} icon="wallet" href="/accounts/outstanding" alert={customerReceivable > 0} />
          <KpiCard label="Payable" value={money(payable)} icon="credit" href="/accounts/outstanding" alert={payable > 0} danger />
          <KpiCard label="Open Work" value={num(totalWork)} icon="building" href="#pending-work" alert={totalWork > 0} />
        </section>

        {serviceDue > 0 && (
          <Link href="/accounts/outstanding" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
            <span className="font-bold text-amber-900 dark:text-amber-200">Service work payment pending from customers</span>
            <b className="text-lg text-amber-800 dark:text-amber-300">{money(serviceDue)} →</b>
          </Link>
        )}

        <section className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
          <article id="pending-work" className="overflow-hidden rounded-[24px] border border-[#dce6f4] bg-white shadow-[0_14px_40px_rgba(24,59,110,.06)] dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6 dark:border-slate-800">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.2em] text-blue-600">Priority queue · {dashboardPeriodLabel(period)}</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 dark:text-white">Pending work</h2>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-[#0a2b64] dark:text-blue-300">{totalWork}</p>
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Open items</p>
              </div>
            </div>
            <div className="p-3 sm:p-4">
              {work.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {work.slice(0, 8).map(([label, value], index) => (
                    <Link href="/vehicles" key={label} className="group grid grid-cols-[38px_1fr_auto] items-center gap-3 rounded-2xl border border-transparent bg-[#f7f9fd] px-3 py-3 transition hover:border-blue-200 hover:bg-blue-50/70 dark:bg-slate-950/40">
                      <span className={`grid h-9 w-9 place-items-center rounded-xl ${index === 0 ? "bg-[#0b2b62] text-white" : "bg-white text-blue-700 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800"}`}>
                        <Icon name={index % 2 === 0 ? "clock" : "building"} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black capitalize text-slate-900 dark:text-white">{label.replaceAll("_", " ")}</span>
                        <span className="block text-[10px] font-semibold text-slate-400">Needs follow-up</span>
                      </span>
                      <b className="text-lg font-black text-[#0b2b62] dark:text-blue-300">{value}</b>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-52 place-items-center text-center">
                  <div>
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Icon name="shield" className="h-5 w-5" /></div>
                    <p className="mt-3 text-base font-black text-slate-900 dark:text-white">Work queue clear</p>
                    <p className="mt-1 text-xs text-slate-400">Nothing needs attention in this period.</p>
                  </div>
                </div>
              )}
            </div>
          </article>

          <aside className="rounded-[24px] border border-[#dce6f4] bg-white p-5 shadow-[0_14px_40px_rgba(24,59,110,.06)] dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.2em] text-blue-600">Money position</p>
                <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">What needs attention</h2>
              </div>
              <Icon name="wallet" className="h-5 w-5 text-blue-600" />
            </div>
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              <MoneyRow label="Total receivable" value={money(totalReceivable)} href="/accounts/outstanding" tone="green" />
              <MoneyRow label="Total payable" value={money(payable)} href="/accounts/outstanding" tone="red" />
              <MoneyRow label="Commission due" value={money(commissionDue)} href="/reports/insurance-commission" tone="blue" />
              <MoneyRow label={`Company payment · ${companyPending.count} pending`} value={money(companyPending.amount)} href="/insurance/company-payments" tone={companyPending.count > 0 ? "red" : "green"} />
            </div>
            {otherReceivable > 0 && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">Other ledger receivable included: {money(otherReceivable)}</p>}
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <ActionPanel title="Daily work" kicker="Quick actions" items={workActions} />
          <ActionPanel title="Money & reports" kicker="Finance" items={moneyActions} />
        </section>
      </div>
    </main>
  );
}

function KpiCard({ label, value, icon, href, alert = false, danger = false }: { label: string; value: string; icon: string; href: string; alert?: boolean; danger?: boolean }) {
  const accent = danger && alert ? "text-rose-700 dark:text-rose-300" : alert ? "text-amber-700 dark:text-amber-300" : "text-[#0b2b62] dark:text-blue-300";
  return (
    <Link href={href} className="group flex min-h-[92px] items-center gap-3 rounded-[20px] border border-[#dce6f4] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${danger && alert ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40" : alert ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40" : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"}`}>
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[9px] font-black uppercase tracking-[.12em] text-slate-400">{label}</span>
        <span className={`mt-1 block truncate text-xl font-black tracking-tight ${accent}`}>{value}</span>
      </span>
    </Link>
  );
}

function MoneyRow({ label, value, href, tone }: { label: string; value: string; href: string; tone: "green" | "red" | "blue" }) {
  const valueClass = tone === "green" ? "text-emerald-700 dark:text-emerald-300" : tone === "red" ? "text-rose-700 dark:text-rose-300" : "text-blue-700 dark:text-blue-300";
  return (
    <Link href={href} className="flex items-center justify-between gap-3 py-3 transition hover:pl-1">
      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}</span>
      <b className={`text-sm ${valueClass}`}>{value}</b>
    </Link>
  );
}

function ActionPanel({ title, kicker, items }: { title: string; kicker: string; items: readonly (readonly [string, string, string, string])[] }) {
  return (
    <section className="rounded-[24px] border border-[#dce6f4] bg-white p-5 shadow-[0_14px_40px_rgba(24,59,110,.05)] dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4">
        <p className="text-[9px] font-black uppercase tracking-[.2em] text-blue-600">{kicker}</p>
        <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map(([label, desc, href, icon]) => (
          <Link key={label} href={href} className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-[#f8faff] p-3 transition hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800"><Icon name={icon} className="h-4 w-4" /></span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-black text-slate-900 dark:text-white">{label}</span>
              <span className="mt-0.5 block truncate text-[9px] font-semibold text-slate-400">{desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
