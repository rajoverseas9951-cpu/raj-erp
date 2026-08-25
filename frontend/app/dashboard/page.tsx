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
    <main className="min-h-screen bg-[#f5f7fb] pb-8 text-[#15233d] antialiased dark:bg-[#080c14] dark:text-slate-100">
      <div className="mx-auto max-w-[1560px] px-4 pb-8 pt-3 sm:px-6 lg:px-8 lg:pt-4">
        <header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#10264b] text-white shadow-sm"><Icon name="dashboard" className="h-4 w-4" /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-[24px] font-semibold leading-none tracking-[-.035em] text-[#112441] sm:text-[28px] dark:text-white">{clock.greeting}</h1>
                <span className="hidden h-4 w-px bg-[#d9e0ea] sm:block dark:bg-white/10" />
                <p className="text-[11px] font-medium text-[#8e9bb0]">{clock.date} · {clock.time} IST</p>
              </div>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[.16em] text-[#7b8aa2]">Vimawallah dashboard</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#e6eaf1] bg-white p-1.5 shadow-[0_8px_24px_rgba(40,59,97,.05)] dark:border-white/10 dark:bg-white/[.05]">
            <select value={period} onChange={(e) => setPeriod(e.target.value as DashboardPeriod)} className="h-9 min-w-36 rounded-xl border-0 bg-transparent px-3 text-[10px] font-semibold text-[#55647d] outline-none dark:text-slate-200">{DASHBOARD_PERIODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <button onClick={() => void refresh(true)} disabled={refreshing} className="h-9 rounded-xl px-3 text-[10px] font-semibold text-[#66758c] transition hover:bg-[#f4f7fb] disabled:opacity-50 dark:hover:bg-white/10">{refreshing ? "Refreshing…" : "Refresh"}</button>
            <Link href="/reports" className="flex h-9 items-center gap-1.5 rounded-xl bg-[#10264b] px-4 text-[10px] font-semibold text-white">Reports <Icon name="arrow" className="h-3 w-3" /></Link>
          </div>
        </header>

        {period === "custom" && <div className="mb-3 grid gap-2 rounded-2xl border border-[#e6eaf1] bg-white p-2.5 sm:grid-cols-[1fr_1fr_auto] dark:border-white/10 dark:bg-white/[.05]"><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-xl border border-[#dde3ec] bg-white px-3 text-xs outline-none dark:border-white/10 dark:bg-white/[.05]" /><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-xl border border-[#dde3ec] bg-white px-3 text-xs outline-none dark:border-white/10 dark:bg-white/[.05]" /><button onClick={() => void refresh(true)} className="h-9 rounded-xl bg-[#1768ff] px-5 text-xs font-semibold text-white">Apply</button></div>}
        {error && <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

        <section className="grid gap-4 xl:grid-cols-[1.55fr_.45fr]">
          <article className="relative overflow-hidden rounded-[28px] bg-[#07172f] text-white shadow-[0_24px_60px_-34px_rgba(17,47,111,.55)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(33,105,255,.52),transparent_31%),radial-gradient(circle_at_92%_8%,rgba(101,74,255,.34),transparent_30%)]" />
            <div className="relative p-6 sm:p-7 lg:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5 text-[8px] font-bold uppercase tracking-[.15em] text-cyan-100">Collection position</span><span className="rounded-full bg-white/[.06] px-3 py-1.5 text-[8px] font-semibold text-white/55">{dashboardPeriodLabel(period)}</span></div>
                <Link href="/accounts/outstanding" className="text-[9px] font-semibold text-cyan-200 hover:text-white">Open outstanding →</Link>
              </div>
              <p className="mt-5 text-[50px] font-semibold leading-none tracking-[-.06em] sm:text-[64px] xl:text-[72px]">{money(totalReceivable)}</p>
              <p className="mt-2 text-[10px] text-white/45">Live receivable position across customer and ledger balances.</p>

              <div className="mt-6 grid gap-px overflow-hidden rounded-[20px] border border-white/10 bg-white/10 sm:grid-cols-4">
                <HeroMetric label="Active policies" value={num(policies)} note="In force" accent="blue" />
                <HeroMetric label="Vehicles" value={num(vehicles)} note="Managed" accent="cyan" />
                <HeroMetric label="Renewals due" value={num(due)} note="Follow-up" accent="amber" />
                <HeroMetric label="Company pending" value={num(companyPending.count)} note={money(companyPending.amount)} accent="emerald" />
              </div>
            </div>
          </article>

          <aside className="overflow-hidden rounded-[28px] border border-[#e4e9f1] bg-white shadow-[0_14px_38px_rgba(38,58,96,.06)] dark:border-white/10 dark:bg-white/[.05]">
            <div className="border-b border-[#edf0f5] px-4 py-4 dark:border-white/10">
              <p className="text-[8px] font-bold uppercase tracking-[.16em] text-blue-500">Quick actions</p>
              <h2 className="mt-1 text-[20px] font-semibold tracking-[-.03em] text-[#192d4c] dark:text-white">Start work</h2>
            </div>
            <div className="grid grid-cols-2 gap-px bg-[#edf0f5] dark:bg-white/10">
              {quickActions.map(([label, desc, href, icon, gradient]) => <QuickAction key={label} label={label} desc={desc} href={href} icon={icon} gradient={gradient} />)}
            </div>
          </aside>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
          <article id="pending-work" className="overflow-hidden rounded-[28px] border border-[#e4e9f1] bg-white shadow-[0_14px_38px_rgba(38,58,96,.06)] dark:border-white/10 dark:bg-white/[.05]">
            <div className="flex flex-col gap-3 border-b border-[#edf0f5] px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
              <div><p className="text-[8px] font-bold uppercase tracking-[.16em] text-violet-500">Priority work</p><h2 className="mt-1 text-[22px] font-semibold tracking-[-.03em] text-[#192d4c] dark:text-white">What needs attention now</h2></div>
              <div className="rounded-xl bg-violet-50 px-3 py-2 text-right dark:bg-violet-500/10"><p className="text-[20px] font-bold leading-none text-violet-700 dark:text-violet-300">{num(totalWork)}</p><p className="mt-1 text-[7px] font-bold uppercase tracking-[.12em] text-violet-400">open items</p></div>
            </div>
            <div className="px-4 py-2 sm:px-5">
              {work.length ? work.slice(0, 6).map(([label, value], index) => (
                <Link key={label} href="/vehicles" className="group flex min-h-[64px] items-center gap-3 border-b border-[#eef2f7] px-1 py-3 last:border-b-0 dark:border-white/10">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${index % 4 === 0 ? "bg-amber-50 text-amber-600" : index % 4 === 1 ? "bg-blue-50 text-blue-600" : index % 4 === 2 ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 text-violet-600"}`}><Icon name={index % 2 === 0 ? "clock" : "building"} className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold capitalize text-[#243a5e] dark:text-white">{label.replaceAll("_", " ")}</span><span className="mt-0.5 block text-[8px] text-[#98a4b6]">Needs follow-up</span></span>
                  <span className="grid h-8 min-w-8 place-items-center rounded-xl bg-[#f4f6fa] px-2 text-[10px] font-bold text-[#445775] dark:bg-white/10 dark:text-white">{value}</span>
                  <Icon name="chevron" className="h-3.5 w-3.5 text-[#a5afbe] transition group-hover:translate-x-0.5" />
                </Link>
              )) : <div className="grid min-h-[180px] place-items-center text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Icon name="shield" className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-[#243a5e] dark:text-white">No pending work</p><p className="mt-1 text-[9px] text-[#98a4b6]">Everything is under control.</p></div></div>}
            </div>
          </article>

          <aside className="self-start overflow-hidden rounded-[28px] bg-[#10294f] text-white shadow-[0_16px_40px_rgba(16,41,79,.16)]">
            <div className="px-5 py-5">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[8px] font-bold uppercase tracking-[.16em] text-cyan-300">Financial overview</p><h2 className="mt-1 text-[21px] font-semibold tracking-[-.03em]">Money position</h2></div><Icon name="wallet" className="h-5 w-5 text-cyan-300" /></div>
              <div className="mt-4 space-y-0">
                <FinanceRow label="Total receivable" value={money(totalReceivable)} tone="cyan" />
                <FinanceRow label="Customer due" value={money(customerReceivable)} tone="cyan" />
                <FinanceRow label="Payable" value={money(payable)} tone={payable > 0 ? "rose" : "emerald"} />
                <FinanceRow label="Commission due" value={money(commissionDue)} tone="violet" />
                <FinanceRow label="Company payments" value={money(companyPending.amount)} note={`${companyPending.count} pending`} tone={companyPending.count > 0 ? "amber" : "emerald"} />
              </div>
              {serviceDue > 0 && <Link href="/accounts/outstanding" className="mt-3 flex items-center justify-between rounded-xl bg-amber-400/10 px-3 py-2 text-[9px] font-semibold text-amber-200"><span>Service due</span><strong>{money(serviceDue)}</strong></Link>}
              <div className="mt-4 grid grid-cols-2 gap-2"><Link href="/accounts/outstanding" className="rounded-xl bg-white px-3 py-2.5 text-center text-[9px] font-semibold text-[#10294f]">Open outstanding</Link><Link href="/accounts/cash-bank" className="rounded-xl border border-white/10 bg-white/[.06] px-3 py-2.5 text-center text-[9px] font-semibold text-white">Receive / Pay</Link></div>
              {otherReceivable > 0 && <p className="mt-3 text-[7px] leading-4 text-white/35">Includes {money(otherReceivable)} in other ledger receivables.</p>}
            </div>
          </aside>
        </section>

        <section className="mt-4 overflow-hidden rounded-[24px] border border-[#e4e9f1] bg-white shadow-[0_10px_30px_rgba(38,58,96,.04)] dark:border-white/10 dark:bg-white/[.05]">
          <div className="grid grid-cols-2 divide-x divide-y divide-[#edf0f5] sm:grid-cols-4 sm:divide-y-0 dark:divide-white/10">
            <BottomStat label="Active policies" value={num(policies)} />
            <BottomStat label="Vehicles" value={num(vehicles)} />
            <BottomStat label="Renewals due" value={num(due)} />
            <BottomStat label="Company pending" value={num(companyPending.count)} tone="amber" />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-[#edf0f5] p-3 dark:border-white/10">
            {tools.map(([label, desc, href, icon]) => <ToolChip key={label} label={label} desc={desc} href={href} icon={icon} />)}
          </div>
        </section>
      </div>
    </main>
  );
}

function HeroMetric({ label, value, note, accent }: { label: string; value: string; note: string; accent: "blue" | "cyan" | "amber" | "emerald" }) {
  const color = accent === "amber" ? "text-amber-300" : accent === "emerald" ? "text-emerald-300" : accent === "cyan" ? "text-cyan-300" : "text-blue-300";
  return <div className="bg-white/[.055] px-4 py-4 sm:px-5"><p className="text-[7px] font-bold uppercase tracking-[.14em] text-white/42">{label}</p><p className={`mt-2 text-[20px] font-bold tracking-[-.03em] ${color}`}>{value}</p><p className="mt-1 text-[7px] text-white/35">{note}</p></div>;
}

function QuickAction({ label, desc, href, icon, gradient }: { label: string; desc: string; href: string; icon: string; gradient: string }) {
  return <Link href={href} className="group min-h-[122px] bg-white p-4 transition hover:bg-[#fafcff] dark:bg-[#0f1520] dark:hover:bg-white/[.07]"><span className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-[0_10px_22px_rgba(38,80,190,.16)] transition group-hover:-translate-y-0.5`}><Icon name={icon} className="h-5 w-5" /></span><span className="mt-3 block text-[11px] font-semibold text-[#203653] dark:text-white">{label}</span><span className="mt-1 block text-[8px] text-[#98a4b6]">{desc}</span></Link>;
}

function FinanceRow({ label, value, note, tone }: { label: string; value: string; note?: string; tone: "cyan" | "rose" | "emerald" | "violet" | "amber" }) {
  const color = tone === "rose" ? "text-rose-300" : tone === "emerald" ? "text-emerald-300" : tone === "violet" ? "text-violet-300" : tone === "amber" ? "text-amber-300" : "text-cyan-300";
  return <div className="flex items-center justify-between gap-3 border-b border-white/10 py-3 last:border-b-0"><span><span className="block text-[8px] font-medium text-white/55">{label}</span>{note && <span className="mt-0.5 block text-[7px] text-white/30">{note}</span>}</span><strong className={`text-[11px] font-bold ${color}`}>{value}</strong></div>;
}

function BottomStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "amber" }) {
  return <div className="px-5 py-4"><p className="text-[7px] font-bold uppercase tracking-[.14em] text-[#8b98ad]">{label}</p><p className={`mt-2 text-[24px] font-semibold leading-none tracking-[-.04em] ${tone === "amber" ? "text-amber-600" : "text-[#183255] dark:text-white"}`}>{value}</p></div>;
}

function ToolChip({ label, desc, href, icon }: { label: string; desc: string; href: string; icon: string }) {
  return <Link href={href} className="flex min-w-[140px] items-center gap-2 rounded-xl border border-[#e7ebf2] bg-[#fbfcfe] px-3 py-2 transition hover:border-blue-200 hover:bg-blue-50/50 dark:border-white/10 dark:bg-white/[.03] dark:hover:bg-white/[.07]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#55708f] shadow-sm dark:bg-white/10 dark:text-slate-300"><Icon name={icon} className="h-3.5 w-3.5" /></span><span className="min-w-0"><span className="block text-[9px] font-semibold text-[#334b69] dark:text-white">{label}</span><span className="block truncate text-[7px] text-[#9aa6b7]">{desc}</span></span></Link>;
}
