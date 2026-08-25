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
type Tone = "blue" | "cyan" | "violet" | "emerald" | "amber" | "rose";
type ActionItem = readonly [string, string, string, string, Tone];

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

const tones: Record<Tone, {
  icon: string;
  iconDark: string;
  dot: string;
  text: string;
  border: string;
  glow: string;
  gradient: string;
}> = {
  blue: {
    icon: "bg-blue-50 text-blue-600",
    iconDark: "dark:bg-blue-500/15 dark:text-blue-300",
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-300",
    border: "hover:border-blue-200 dark:hover:border-blue-500/30",
    glow: "bg-blue-400/20",
    gradient: "from-blue-500 to-indigo-500",
  },
  cyan: {
    icon: "bg-cyan-50 text-cyan-700",
    iconDark: "dark:bg-cyan-500/15 dark:text-cyan-300",
    dot: "bg-cyan-500",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "hover:border-cyan-200 dark:hover:border-cyan-500/30",
    glow: "bg-cyan-400/20",
    gradient: "from-cyan-400 to-blue-500",
  },
  violet: {
    icon: "bg-violet-50 text-violet-600",
    iconDark: "dark:bg-violet-500/15 dark:text-violet-300",
    dot: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-300",
    border: "hover:border-violet-200 dark:hover:border-violet-500/30",
    glow: "bg-violet-400/20",
    gradient: "from-violet-500 to-fuchsia-500",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-700",
    iconDark: "dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "hover:border-emerald-200 dark:hover:border-emerald-500/30",
    glow: "bg-emerald-400/20",
    gradient: "from-emerald-400 to-cyan-500",
  },
  amber: {
    icon: "bg-amber-50 text-amber-700",
    iconDark: "dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    border: "hover:border-amber-200 dark:hover:border-amber-500/30",
    glow: "bg-amber-400/20",
    gradient: "from-amber-400 to-orange-500",
  },
  rose: {
    icon: "bg-rose-50 text-rose-600",
    iconDark: "dark:bg-rose-500/15 dark:text-rose-300",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-300",
    border: "hover:border-rose-200 dark:hover:border-rose-500/30",
    glow: "bg-rose-400/20",
    gradient: "from-rose-400 to-orange-500",
  },
};

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
    try {
      setBalances(await financeControlApi.outstanding());
    } catch {
      setBalances(null);
    }
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
  const renewalPressure = Math.min(100, policies > 0 ? Math.round((due / policies) * 100) : 0);
  const queuePressure = Math.min(100, totalWork > 0 ? Math.min(92, 18 + totalWork * 4) : 4);
  const collectionPressure = Math.min(100, totalReceivable > 0 ? 72 : 8);

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#f3f6ff] pb-14 text-[#132445] antialiased dark:bg-[#060914] dark:text-slate-100"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-52 -top-56 h-[620px] w-[620px] rounded-full bg-blue-300/22 blur-[110px] dark:bg-blue-500/10" />
        <div className="absolute -right-64 top-10 h-[650px] w-[650px] rounded-full bg-violet-300/20 blur-[120px] dark:bg-violet-500/10" />
        <div className="absolute bottom-[-310px] left-[28%] h-[620px] w-[620px] rounded-full bg-cyan-200/22 blur-[120px] dark:bg-cyan-500/10" />
      </div>

      <div className="relative mx-auto max-w-[1540px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative grid h-13 w-13 place-items-center rounded-[18px] bg-gradient-to-br from-[#1768ff] via-[#4777ff] to-[#8457ff] text-white shadow-[0_16px_34px_rgba(57,88,247,.30)]">
              <span className="absolute inset-0 rounded-[18px] bg-white/10" />
              <Icon name="dashboard" className="relative h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.9)]" />
                <p className="text-[9px] font-bold uppercase tracking-[.22em] text-[#8594ae] dark:text-slate-500">Vimawallah live workspace</p>
              </div>
              <h1 className="mt-1.5 text-[30px] font-[650] leading-none tracking-[-.045em] text-[#142748] sm:text-[36px] dark:text-white">{clock.greeting}</h1>
              <p className="mt-1.5 text-[10px] font-medium text-[#98a5bb]">{clock.date} · {clock.time} IST</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-[17px] border border-white/80 bg-white/72 p-1.5 shadow-[0_12px_34px_rgba(37,67,124,.075)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[.055]">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
              className="h-9 min-w-40 rounded-xl border-0 bg-transparent px-3 text-[10px] font-semibold text-[#596b88] outline-none dark:text-slate-200"
              aria-label="Dashboard period"
            >
              {DASHBOARD_PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="hidden h-5 w-px bg-[#dfe7f4] sm:block dark:bg-white/10" />
            <button
              onClick={() => void refresh(true)}
              disabled={refreshing}
              className="h-9 rounded-xl px-3.5 text-[10px] font-semibold text-[#71809a] transition hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-cyan-200"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <Link href="/reports" className="flex h-9 items-center gap-2 rounded-xl bg-[#14284e] px-4 text-[10px] font-semibold text-white shadow-[0_8px_20px_rgba(20,40,78,.18)] transition hover:-translate-y-0.5 hover:bg-[#0b1c3c]">
              Reports <Icon name="arrow" className="h-3 w-3" />
            </Link>
          </div>
        </header>

        {period === "custom" && (
          <div className="mb-4 grid gap-2 rounded-[18px] border border-white/80 bg-white/75 p-3 shadow-[0_12px_34px_rgba(36,65,120,.06)] backdrop-blur-xl sm:grid-cols-[1fr_1fr_auto] dark:border-white/10 dark:bg-white/[.05]">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-xl border border-[#dce5f4] bg-white/85 px-3 text-xs font-medium outline-none focus:border-blue-300 dark:border-white/10 dark:bg-white/[.06]" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-xl border border-[#dce5f4] bg-white/85 px-3 text-xs font-medium outline-none focus:border-blue-300 dark:border-white/10 dark:bg-white/[.06]" />
            <button onClick={() => void refresh(true)} className="h-10 rounded-xl bg-gradient-to-r from-[#1768ff] to-[#7656ff] px-5 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(55,90,255,.22)]">Apply period</button>
          </div>
        )}

        {error && <div className="mb-4 rounded-[18px] border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-700 shadow-sm">{error}</div>}

        <section className="relative mb-4 overflow-hidden rounded-[34px] bg-[#081733] text-white shadow-[0_30px_80px_-34px_rgba(16,48,125,.62)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_4%_10%,rgba(21,105,255,.58),transparent_28%),radial-gradient(circle_at_96%_0%,rgba(124,72,255,.52),transparent_31%),radial-gradient(circle_at_74%_100%,rgba(0,220,255,.26),transparent_32%)]" />
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="absolute -right-16 -top-24 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -right-5 -top-12 h-56 w-56 rounded-full border border-white/[.07]" />

          <div className="relative grid gap-5 p-5 sm:p-7 xl:grid-cols-[1.08fr_.92fr] xl:p-8">
            <div className="flex min-h-[300px] flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5 text-[8px] font-bold uppercase tracking-[.18em] text-cyan-100 backdrop-blur-xl">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.9)]" /> Business pulse
                  </span>
                  <span className="rounded-full bg-white/[.06] px-3 py-1.5 text-[8px] font-semibold text-white/55">{dashboardPeriodLabel(period)}</span>
                </div>

                <p className="mt-6 text-[9px] font-semibold uppercase tracking-[.2em] text-white/45">Total collection position</p>
                <p className="mt-2 text-[43px] font-[650] leading-none tracking-[-.055em] text-white sm:text-[58px] xl:text-[66px]">{money(totalReceivable)}</p>
                <p className="mt-3 max-w-xl text-[11px] leading-5 text-blue-100/50 sm:text-[12px]">Your live money position, renewals and pending operational load — distilled into one command surface.</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <StatusPill label="Renewals" value={num(due)} tone={due > 0 ? "rose" : "emerald"} />
                  <StatusPill label="Open work" value={num(totalWork)} tone={totalWork > 0 ? "violet" : "emerald"} />
                  <StatusPill label="Company pay" value={num(companyPending.count)} tone={companyPending.count > 0 ? "amber" : "emerald"} />
                </div>
              </div>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <Link href="/accounts/outstanding" className="rounded-[13px] bg-white px-4 py-2.5 text-[10px] font-semibold text-[#0e2347] shadow-[0_9px_22px_rgba(0,0,0,.14)] transition hover:-translate-y-0.5 hover:bg-blue-50">Review collections</Link>
                <Link href="/insurance/motor" className="rounded-[13px] border border-white/10 bg-white/[.07] px-4 py-2.5 text-[10px] font-semibold text-white backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/[.11]">Create motor policy</Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <HeroStat label="Customer due" value={money(customerReceivable)} note="Collectable" icon="wallet" tone="cyan" />
              <HeroStat label="Payable" value={money(payable)} note={payable > 0 ? "Needs attention" : "Clear"} icon="credit" tone={payable > 0 ? "rose" : "emerald"} />
              <HeroStat label="Commission due" value={money(commissionDue)} note="Expected income" icon="rupee" tone="violet" />
              <HeroStat label="Company payments" value={money(companyPending.amount)} note={`${companyPending.count} pending`} icon="building" tone={companyPending.count > 0 ? "amber" : "emerald"} />
            </div>
          </div>
        </section>

        <section className="mb-4 grid gap-3 xl:grid-cols-[1.1fr_.9fr]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            <MetricCard label="Active policies" value={num(policies)} helper="Currently protected" icon="shield" tone="blue" href="/insurance" />
            <MetricCard label="Renewals due" value={num(due)} helper={due > 0 ? "Follow-up required" : "All caught up"} icon="clock" tone={due > 0 ? "rose" : "emerald"} href="/insurance" />
            <MetricCard label="Open work" value={num(totalWork)} helper={totalWork > 0 ? "Queue needs attention" : "Queue clear"} icon="building" tone={totalWork > 0 ? "violet" : "emerald"} href="#pending-work" />
            <MetricCard label="Vehicles" value={num(vehicles)} helper="Managed records" icon="vehicle" tone="cyan" href="/vehicles" />
          </div>

          <article className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/78 p-5 shadow-[0_18px_48px_rgba(38,69,127,.075)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[.05] sm:p-6">
            <div className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full bg-gradient-to-br from-violet-300/25 to-blue-300/10 blur-3xl dark:from-violet-500/10" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[.22em] text-[#8b99b0]">Today’s focus</p>
                <h2 className="mt-1.5 text-[20px] font-[650] tracking-[-.035em] text-[#1c3155] dark:text-white">Business health radar</h2>
                <p className="mt-1 text-[9px] text-[#9ba8bc]">Three signals worth watching first.</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-gradient-to-br from-violet-100 to-blue-100 text-violet-600 dark:from-violet-500/15 dark:to-blue-500/15 dark:text-violet-300"><Icon name="reports" className="h-4 w-4" /></span>
            </div>

            <div className="relative mt-5 grid grid-cols-3 gap-3">
              <FocusGauge label="Collections" value={collectionPressure} tone="cyan" />
              <FocusGauge label="Renewals" value={renewalPressure} tone={renewalPressure > 20 ? "rose" : "blue"} />
              <FocusGauge label="Workload" value={queuePressure} tone={totalWork > 0 ? "violet" : "emerald"} />
            </div>
          </article>
        </section>

        {serviceDue > 0 && (
          <Link href="/accounts/outstanding" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-amber-200/70 bg-gradient-to-r from-amber-50/95 via-orange-50/80 to-rose-50/70 px-5 py-3.5 shadow-[0_10px_30px_rgba(200,130,30,.07)] dark:border-amber-900/50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-rose-950/10">
            <span className="flex items-center gap-2.5 text-[10px] font-bold text-amber-900 dark:text-amber-200"><span className="grid h-7 w-7 place-items-center rounded-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/50"><Icon name="clock" className="h-3.5 w-3.5" /></span> Service collection needs attention</span>
            <span className="text-[12px] font-bold text-amber-800 dark:text-amber-300">{money(serviceDue)} →</span>
          </Link>
        )}

        <section className="mb-4 grid gap-4 xl:grid-cols-[1.28fr_.72fr]">
          <article id="pending-work" className="overflow-hidden rounded-[28px] border border-white/80 bg-white/80 shadow-[0_18px_50px_rgba(38,69,127,.075)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[.05]">
            <div className="flex flex-col gap-4 border-b border-[#edf2fb] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[.2em] text-violet-500"><span className="h-1.5 w-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,.55)]" /> Priority queue</div>
                <h2 className="mt-1.5 text-[22px] font-[650] tracking-[-.035em] text-[#17284a] dark:text-white">Work requiring attention</h2>
                <p className="mt-1 text-[9px] text-[#93a0b7]">Clear the important items first, then move to routine work.</p>
              </div>
              <div className="flex items-center gap-3 rounded-[17px] bg-violet-50 px-4 py-3 dark:bg-violet-500/10">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-violet-600 shadow-sm dark:bg-white/10 dark:text-violet-300"><Icon name="clock" className="h-3.5 w-3.5" /></span>
                <div><p className="text-[22px] font-[650] leading-none tracking-[-.04em] text-violet-700 dark:text-violet-300">{num(totalWork)}</p><p className="mt-1 text-[7px] font-bold uppercase tracking-[.14em] text-violet-400">open items</p></div>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              {work.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {work.slice(0, 8).map(([label, value], index) => {
                    const tone: Tone = (["blue", "violet", "cyan", "amber"] as Tone[])[index % 4];
                    const t = tones[tone];
                    return (
                      <Link key={label} href="/vehicles" className={`group relative flex items-center gap-3 overflow-hidden rounded-[18px] border border-transparent bg-[#f8faff] px-3.5 py-3 transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_24px_rgba(48,75,130,.08)] dark:bg-white/[.035] dark:hover:bg-white/[.07] ${t.border}`}>
                        <div className={`pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full ${t.glow} opacity-0 blur-2xl transition group-hover:opacity-100`} />
                        <span className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-[14px] ${t.icon} ${t.iconDark}`}><Icon name={index % 2 === 0 ? "clock" : "building"} className="h-4 w-4" /></span>
                        <span className="relative min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold capitalize text-[#2a3b5f] dark:text-white">{label.replaceAll("_", " ")}</span><span className="mt-0.5 flex items-center gap-1.5 text-[8px] font-medium text-[#9aa6ba]"><span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />Needs follow-up</span></span>
                        <span className="relative grid h-8 min-w-8 place-items-center rounded-xl bg-white px-2 text-[10px] font-bold tabular-nums text-[#42567d] shadow-sm ring-1 ring-[#edf1f7] transition group-hover:bg-[#17284a] group-hover:text-white dark:bg-white/10 dark:text-white dark:ring-white/10">{value}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="grid min-h-56 place-items-center text-center">
                  <div>
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-gradient-to-br from-emerald-100 to-cyan-100 text-emerald-600 shadow-sm dark:from-emerald-500/15 dark:to-cyan-500/15 dark:text-emerald-300"><Icon name="shield" className="h-6 w-6" /></div>
                    <p className="mt-4 text-[13px] font-bold text-[#29405f] dark:text-white">Everything is under control</p>
                    <p className="mt-1 text-[9px] text-[#9aa6b8]">No pending work needs attention in this period.</p>
                  </div>
                </div>
              )}
            </div>
          </article>

          <aside className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_18px_50px_rgba(38,69,127,.075)] backdrop-blur-2xl sm:p-6 dark:border-white/10 dark:bg-white/[.05]">
            <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-500/10" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[.2em] text-cyan-600"><span className="h-1.5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,.55)]" /> Money flow</div>
                <h2 className="mt-1.5 text-[21px] font-[650] tracking-[-.035em] text-[#17284a] dark:text-white">Financial cockpit</h2>
                <p className="mt-1 text-[9px] text-[#98a5ba]">See where the money is — instantly.</p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-[16px] bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-700 shadow-sm dark:from-cyan-500/15 dark:to-blue-500/15 dark:text-cyan-300"><Icon name="wallet" className="h-5 w-5" /></span>
            </div>

            <div className="relative mt-5 space-y-2">
              <FinanceRow label="Receivable" value={money(totalReceivable)} href="/accounts/outstanding" tone="cyan" />
              <FinanceRow label="Payable" value={money(payable)} href="/accounts/outstanding" tone={payable > 0 ? "rose" : "emerald"} attention={payable > 0} />
              <FinanceRow label="Commission due" value={money(commissionDue)} href="/reports/insurance-commission" tone="violet" />
              <FinanceRow label="Company payments" value={money(companyPending.amount)} href="/insurance/company-payments" tone={companyPending.count > 0 ? "amber" : "emerald"} note={`${companyPending.count} pending`} attention={companyPending.count > 0} />
            </div>

            {otherReceivable > 0 && <p className="relative mt-4 rounded-xl bg-[#f6f9ff] px-3.5 py-3 text-[8px] leading-5 text-[#8492a8] dark:bg-white/[.04] dark:text-slate-400">Includes {money(otherReceivable)} in other ledger receivables.</p>}
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.06fr_.94fr]">
          <article className="rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_18px_50px_rgba(38,69,127,.07)] backdrop-blur-2xl sm:p-6 dark:border-white/10 dark:bg-white/[.05]">
            <SectionTitle eyebrow="Daily desk" title="Start something" copy="Your most-used actions, one click away." tone="blue" />
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {primaryActions.map(([label, desc, href, icon, tone]) => <ActionCard key={label} label={label} desc={desc} href={href} icon={icon} tone={tone} />)}
            </div>
          </article>

          <article className="rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_18px_50px_rgba(38,69,127,.07)] backdrop-blur-2xl sm:p-6 dark:border-white/10 dark:bg-white/[.05]">
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

function StatusPill({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const t = tones[tone];
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.065] px-3 py-1.5 text-[8px] font-semibold text-white/65 backdrop-blur-lg">
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /> {label} <strong className="text-white">{value}</strong>
    </span>
  );
}

function HeroStat({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: string; tone: Tone }) {
  const t = tones[tone];
  return (
    <div className="group relative min-h-[136px] overflow-hidden rounded-[23px] border border-white/10 bg-white/[.065] p-4.5 backdrop-blur-2xl transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[.085] sm:p-5">
      <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full ${t.glow} blur-3xl transition duration-300 group-hover:scale-125`} />
      <div className="relative flex h-full min-h-[104px] flex-col justify-between">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[8px] font-semibold uppercase tracking-[.16em] text-white/48">{label}</span>
          <span className="grid h-8 w-8 place-items-center rounded-[11px] bg-white/10 text-white/75"><Icon name={icon} className="h-3.5 w-3.5" /></span>
        </div>
        <div>
          <p className="truncate text-[18px] font-[650] tracking-[-.035em] text-white sm:text-[21px]">{value}</p>
          <p className={`mt-1 flex items-center gap-1.5 text-[8px] font-medium ${t.text}`}><span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />{note}</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, helper, icon, tone, href }: { label: string; value: string; helper: string; icon: string; tone: Tone; href: string }) {
  const t = tones[tone];
  return (
    <Link href={href} className={`group relative overflow-hidden rounded-[25px] border border-white/80 bg-white/80 p-4 shadow-[0_14px_38px_rgba(38,69,127,.065)] backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:bg-white hover:shadow-[0_20px_46px_rgba(38,69,127,.11)] dark:border-white/10 dark:bg-white/[.05] dark:hover:bg-white/[.075] ${t.border}`}>
      <div className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full ${t.glow} opacity-50 blur-3xl transition duration-300 group-hover:scale-125 group-hover:opacity-90`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[8px] font-bold uppercase tracking-[.15em] text-[#8d9bb2]">{label}</p>
          <p className="mt-3 truncate text-[28px] font-[650] leading-none tracking-[-.05em] text-[#183056] dark:text-white">{value}</p>
          <p className={`mt-2 flex items-center gap-1.5 text-[8px] font-medium ${t.text}`}><span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />{helper}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] ${t.icon} ${t.iconDark} transition group-hover:scale-105`}><Icon name={icon} className="h-4 w-4" /></span>
      </div>
    </Link>
  );
}

function FocusGauge({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const t = tones[tone];
  const color = tone === "cyan" ? "#06b6d4" : tone === "rose" ? "#f43f5e" : tone === "violet" ? "#8b5cf6" : tone === "emerald" ? "#10b981" : "#3b82f6";
  return (
    <div className="rounded-[18px] bg-[#f8faff] p-3 text-center dark:bg-white/[.035]">
      <div className="relative mx-auto h-16 w-16 rounded-full p-[6px]" style={{ background: `conic-gradient(${color} ${Math.max(value, 4)}%, rgba(213,222,238,.45) 0)` }}>
        <div className="grid h-full w-full place-items-center rounded-full bg-white dark:bg-[#111829]">
          <span className={`text-[12px] font-bold ${t.text}`}>{value}%</span>
        </div>
      </div>
      <p className="mt-2 text-[8px] font-semibold text-[#76859e] dark:text-slate-400">{label}</p>
    </div>
  );
}

function FinanceRow({ label, value, href, tone, note, attention = false }: { label: string; value: string; href: string; tone: Tone; note?: string; attention?: boolean }) {
  const t = tones[tone];
  return (
    <Link href={href} className={`group relative flex items-center gap-3 overflow-hidden rounded-[17px] border border-transparent bg-[#f8faff] px-3.5 py-3 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_9px_22px_rgba(45,72,125,.07)] dark:bg-white/[.035] dark:hover:bg-white/[.07] ${t.border}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[11px] ${t.icon} ${t.iconDark}`}><span className={`h-2 w-2 rounded-full ${t.dot} ${attention ? "shadow-[0_0_9px_currentColor]" : ""}`} /></span>
      <span className="min-w-0 flex-1"><span className="block text-[9px] font-semibold text-[#64748f] dark:text-slate-300">{label}</span>{note && <span className={`mt-0.5 block text-[7px] font-medium ${t.text}`}>{note}</span>}</span>
      <span className={`text-[10px] font-bold tabular-nums ${t.text}`}>{value}</span>
    </Link>
  );
}

function SectionTitle({ eyebrow, title, copy, tone }: { eyebrow: string; title: string; copy: string; tone: Tone }) {
  const t = tones[tone];
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className={`flex items-center gap-2 text-[8px] font-bold uppercase tracking-[.2em] ${t.text}`}><span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />{eyebrow}</div>
        <h2 className="mt-1.5 text-[20px] font-[650] tracking-[-.035em] text-[#17284a] dark:text-white">{title}</h2>
        <p className="mt-1 text-[9px] text-[#99a6ba]">{copy}</p>
      </div>
      <span className={`grid h-9 w-9 place-items-center rounded-[13px] ${t.icon} ${t.iconDark}`}><Icon name="arrow" className="h-3.5 w-3.5" /></span>
    </div>
  );
}

function ActionCard({ label, desc, href, icon, tone }: { label: string; desc: string; href: string; icon: string; tone: Tone }) {
  const t = tones[tone];
  return (
    <Link href={href} className={`group relative flex min-h-[74px] items-center gap-3 overflow-hidden rounded-[18px] border border-[#edf2fa] bg-[#f9fbff] px-3.5 py-3 transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_26px_rgba(42,72,128,.08)] dark:border-white/[.07] dark:bg-white/[.03] dark:hover:bg-white/[.07] ${t.border}`}>
      <div className={`pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full ${t.glow} opacity-0 blur-2xl transition group-hover:opacity-100`} />
      <span className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-[14px] ${t.icon} ${t.iconDark}`}><Icon name={icon} className="h-4 w-4" /></span>
      <span className="relative min-w-0 flex-1"><span className="block text-[10px] font-semibold text-[#2c4164] dark:text-white">{label}</span><span className="mt-1 block truncate text-[8px] text-[#9aa7bb]">{desc}</span></span>
      <Icon name="arrow" className="relative h-3.5 w-3.5 text-[#b8c2d1] transition group-hover:translate-x-0.5 group-hover:text-[#526a91]" />
    </Link>
  );
}

function MiniAction({ label, desc, href, icon, tone }: { label: string; desc: string; href: string; icon: string; tone: Tone }) {
  const t = tones[tone];
  return (
    <Link href={href} className={`group rounded-[17px] border border-transparent bg-[#f9fbff] p-3 transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_9px_22px_rgba(42,72,128,.07)] dark:bg-white/[.03] dark:hover:bg-white/[.07] ${t.border}`}>
      <span className={`grid h-8 w-8 place-items-center rounded-[11px] ${t.icon} ${t.iconDark} transition group-hover:scale-105`}><Icon name={icon} className="h-3.5 w-3.5" /></span>
      <span className="mt-2.5 block text-[9px] font-semibold text-[#354b6e] dark:text-white">{label}</span>
      <span className="mt-0.5 block truncate text-[7px] text-[#a0acbd]">{desc}</span>
    </Link>
  );
}
