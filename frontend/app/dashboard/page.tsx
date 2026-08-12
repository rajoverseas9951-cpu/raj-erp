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

const dailyActions = [
  ["New Vehicle", "Add vehicle / RC", "/vehicles/new", "vehicle"],
  ["New Customer", "Create customer", "/customers/new", "customers"],
  ["Motor Insurance", "Customer → vehicle → policy", "/insurance/motor", "shield"],
  ["Non-Motor", "Fire / property / business", "/insurance/non_motor", "shield"],
  ["Health", "Retail / family / group", "/insurance/health", "shield"],
  ["Life", "Term / savings / pension", "/insurance/life", "shield"],
  ["RTO Work", "RTO services", "/vehicles", "building"],
  ["Driving Licence", "Licence work", "/services/driving-licence", "book"],
  ["Passport", "Passport work", "/services/passport", "book"],
] as const;

const accountActions = [
  ["Receive / Pay", "Cash & bank", "/accounts/cash-bank", "credit"],
  ["Receivable / Payable", "Who owes us / whom we owe", "/accounts/outstanding", "wallet"],
  ["Accounts", "Daily accounts", "/accounts", "book"],
  ["Profit & Loss", "Year profit", "/reports/profit-loss", "reports"],
  ["Balance Sheet", "Year position", "/reports/balance-sheet", "book"],
  ["Reports", "Business reports", "/reports", "reports"],
] as const;

function indiaNowParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", weekday: "long", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hour24 = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(date));
  const greeting = hour24 < 12 ? "Good morning" : hour24 < 17 ? "Good afternoon" : hour24 < 21 ? "Good evening" : "Good night";
  return { greeting, date: `${map.weekday}, ${map.day} ${map.month} ${map.year}`, time: `${map.hour}:${map.minute}:${map.second} ${map.dayPeriod}` };
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
  const req = useRef<AbortController | null>(null);
  const [companyPending, setCompanyPending] = useState({ count: 0, amount: 0 });

  const refreshCompanyPayments = useCallback(async () => {
    try {
      const page = await authenticatedRequest<PolicyPage>("/policies?per_page=100");
      const active = (page?.data ?? []).filter((p) => !p.archived_at && !["cancelled", "expired", "draft"].includes(String(p.status || "").toLowerCase()));
      const checks = await Promise.all(active.map(async (p) => {
        try { const s = await authenticatedRequest<SettlementInfo>(`/vehicles/${p.vehicle_id}/insurances/${p.id}/settlement`); return s.settlement ? null : p; }
        catch { return p; }
      }));
      const pending = checks.filter((p): p is PolicyRow => !!p);
      setCompanyPending({ count: pending.length, amount: pending.reduce((s, p) => s + Number(p.customer_pay || p.gross_premium || 0), 0) });
    } catch { setCompanyPending({ count: 0, amount: 0 }); }
  }, []);

  const refreshBalances = useCallback(async () => { try { setBalances(await financeControlApi.outstanding()); } catch { setBalances(null); } }, []);

  const refresh = useCallback(() => {
    if (period === "custom" && (!dateFrom || !dateTo || dateFrom > dateTo)) { setError("Select a valid date range."); return Promise.resolve(); }
    req.current?.abort(); const c = new AbortController(); req.current = c; setRefreshing(true); setError(""); void refreshCompanyPayments(); void refreshBalances();
    return getDashboardSummary({ period, dateFrom, dateTo }, c.signal).then(setData).catch((e) => {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (e instanceof Error && e.message === "AUTH_REQUIRED") { sessionStorage.removeItem("raj_erp_token"); location.replace("/login?next=/dashboard"); return; }
      setError(e instanceof Error ? e.message : "Dashboard could not refresh.");
    }).finally(() => { if (req.current === c) { setRefreshing(false); req.current = null; } });
  }, [period, dateFrom, dateTo, refreshCompanyPayments, refreshBalances]);

  useEffect(() => { const timer = window.setInterval(() => setClock(indiaNowParts(new Date())), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { void refresh(); const r = () => void refresh(); window.addEventListener("focus", r); window.addEventListener(DASHBOARD_REFRESH_EVENT, r); return () => { req.current?.abort(); window.removeEventListener("focus", r); window.removeEventListener(DASHBOARD_REFRESH_EVENT, r); }; }, [refresh]);

  const work = Object.entries(data?.work ?? {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const vehicles = data?.kpis.vehicles?.value ?? 0;
  const policies = data?.kpis.active_policies?.value ?? 0;
  const due = data?.kpis.expiring_policies?.value ?? 0;
  const customerReceivable = Number(balances?.summary.customer_receivable ?? data?.kpis.outstanding_amount?.value ?? data?.revenue.outstanding ?? 0);
  const otherReceivable = Number(balances?.summary.ledger_receivable ?? 0);
  const totalReceivable = Number(balances?.summary.total_receivable ?? (customerReceivable + otherReceivable));
  const payable = Number(balances?.summary.party_payable ?? 0);
  const commissionDue = Number(balances?.summary.insurance_commission_due ?? 0);
  const serviceDue = Number(balances?.summary.service_customer_due ?? 0);
  const totalWork = work.reduce((s, [, v]) => s + v, 0);

  return <main className="min-h-screen bg-[#f4f7fb] pb-10 dark:bg-[#050914]"><div className="mx-auto max-w-[1560px] space-y-4 p-4 sm:p-6 lg:p-7">
    <section className="relative overflow-hidden rounded-[28px] bg-[#071a3c] text-white shadow-[0_24px_65px_-34px_rgba(7,26,60,.8)]"><div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(42,112,255,.5),transparent_30%),linear-gradient(115deg,#06142e_0%,#09265b_62%,#1147b9_100%)]"/><div className="relative px-5 py-5 sm:px-7 sm:py-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.24em] text-cyan-200">Raj Insurance ERP · Daily command center</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-[40px]">{clock.greeting}, ready for today&apos;s work?</h1><div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-blue-100/75"><span>{clock.date}</span><span className="hidden sm:inline">•</span><span className="tabular-nums">{clock.time}</span><span className="text-blue-200/45">IST</span></div></div><Link href="/reports" className="w-fit rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/15">Open reports →</Link></div>
      <div className="mt-5 grid overflow-hidden rounded-2xl border border-white/10 bg-black/[.12] sm:grid-cols-2 lg:grid-cols-6"><Metric label="Vehicles" value={num(vehicles)} icon="vehicle"/><Metric label="Active Policies" value={num(policies)} icon="shield"/><Metric label="Renewal Due" value={num(due)} icon="clock" alert={due>0}/><MetricLink href="/accounts/outstanding" label="Customer Due" value={money(customerReceivable)} icon="wallet" alert={customerReceivable>0} tone="green"/><MetricLink href="/accounts/outstanding" label="Total Payable" value={money(payable)} icon="credit" alert={payable>0} tone="red"/><CompanyPaymentMetric count={companyPending.count} amount={companyPending.amount}/></div>
    </div></section>

    {error&&<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MoneyCard label="Customer Receivable" value={money(customerReceivable)} copy="Policy + RTO/service bills not yet received" href="/accounts/outstanding" tone="green"/>
      <MoneyCard label="Payable" value={money(payable)} copy="Insurer / broker / party payments due" href="/accounts/outstanding" tone="red"/>
      <MoneyCard label="Insurance Commission · Separate" value={money(commissionDue)} copy="Commission due from company/source — not mixed with customer due" href="/reports/insurance-commission" tone="blue"/>
      <MoneyCard label="Total Collection Position" value={money(totalReceivable)} copy={otherReceivable>0?`Includes ${money(otherReceivable)} other ledger receivable`:`Customer collection balance`} href="/accounts/outstanding" tone="amber"/>
    </section>

    {serviceDue>0&&<Link href="/accounts/outstanding" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm"><span className="font-bold text-amber-900">Service work pending from customers</span><b className="text-lg text-amber-800">{money(serviceDue)} →</b></Link>}

    <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]"><ActionPanel title="Daily Work" kicker="Quick Actions" subtitle="Motor, non-motor, health, life and RTO work" items={dailyActions}/><ActionPanel title="Accounts" kicker="Money Control" subtitle="Simple shortcuts — no accounting jargon" items={accountActions}/></section>

    <section className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]"><article className="overflow-hidden rounded-[26px] border border-[#dce6f4] bg-white shadow-[0_16px_45px_rgba(24,59,110,.07)] dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6 dark:border-slate-800"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-blue-600">Priority queue</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">Today&apos;s pending work</h2></div><div className="text-right"><p className="text-3xl font-black tracking-tight text-[#0a2b64] dark:text-blue-300">{totalWork}</p><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Open items</p></div></div><div className="p-3 sm:p-4">{work.length?<div className="grid gap-2 md:grid-cols-2">{work.slice(0,8).map(([label,value],index)=><Link href="/vehicles" key={label} className="group grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-2xl border border-transparent bg-[#f7f9fd] px-3 py-3 transition hover:border-blue-200 hover:bg-blue-50/70 dark:bg-slate-950/40"><span className={`grid h-10 w-10 place-items-center rounded-xl ${index===0?"bg-[#0b2b62] text-white":"bg-white text-blue-700 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800"}`}><Icon name={index%2===0?"clock":"building"} className="h-4 w-4"/></span><span className="min-w-0"><span className="block truncate text-sm font-black capitalize text-slate-900 dark:text-white">{label.replaceAll("_"," ")}</span><span className="block text-[10px] font-semibold text-slate-400">Pending follow-up</span></span><b className="text-lg font-black text-[#0b2b62] dark:text-blue-300">{value}</b></Link>)}</div>:<div className="grid min-h-56 place-items-center text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Icon name="shield" className="h-6 w-6"/></div><p className="mt-4 text-base font-black text-slate-900 dark:text-white">Work queue clear</p><p className="mt-1 text-xs text-slate-400">Nothing needs attention in this period.</p></div></div>}</div></article><aside className="space-y-4"><div className="rounded-[26px] bg-[#081b3f] p-5 text-white shadow-[0_18px_45px_rgba(8,27,63,.18)]"><div className="flex items-start justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-cyan-300">Business snapshot</p><h2 className="mt-1 text-2xl font-black">{dashboardPeriodLabel(period)}</h2></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Icon name="reports" className="h-4 w-4"/></span></div><div className="mt-5 grid grid-cols-2 gap-2"><Mini label="Pending Work" value={num(totalWork)}/><Mini label="Renewal Due" value={num(due)}/><Mini label="Customer Due" value={money(customerReceivable)}/><Mini label="Payable" value={money(payable)}/></div></div><div className="rounded-[26px] border border-[#dce6f4] bg-white p-5 shadow-[0_16px_45px_rgba(24,59,110,.06)] dark:border-slate-800 dark:bg-slate-900"><p className="text-[9px] font-black uppercase tracking-[.2em] text-blue-600">Reporting period</p><select value={period} onChange={e=>setPeriod(e.target.value as DashboardPeriod)} className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white">{DASHBOARD_PERIODS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>{period==="custom"&&<div className="mt-2 grid grid-cols-2 gap-2"><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"/><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"/></div>}<button onClick={()=>void refresh()} disabled={refreshing} className="mt-3 w-full rounded-xl bg-gradient-to-r from-[#0b2b62] to-[#2563eb] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{refreshing?"Refreshing…":"Refresh dashboard"}</button></div></aside></section>
  </div></main>;
}

function ActionPanel({title,kicker,subtitle,items}:{title:string;kicker:string;subtitle:string;items:readonly (readonly [string,string,string,string])[]}){return <section className="rounded-[26px] border border-[#dce6f4] bg-white p-5 shadow-[0_14px_40px_rgba(24,59,110,.06)] dark:border-slate-800 dark:bg-slate-900"><div className="mb-4"><p className="text-[9px] font-black uppercase tracking-[.2em] text-blue-600">{kicker}</p><h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{title}</h2><p className="mt-1 text-xs font-semibold text-slate-400">{subtitle}</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{items.map(([label,desc,href,icon])=><Link key={label} href={href} className="group rounded-2xl border border-slate-100 bg-[#f8faff] p-3.5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-800 dark:bg-slate-950/40"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800"><Icon name={icon} className="h-4 w-4"/></span><p className="mt-3 text-sm font-black text-slate-900 dark:text-white">{label}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-400">{desc}</p></Link>)}</div></section>}
function Metric({label,value,icon,alert=false}:{label:string;value:string;icon:string;alert?:boolean}){return <div className="flex items-center gap-3 border-b border-white/10 p-4 sm:p-5 sm:border-b-0 sm:border-r"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${alert?"bg-amber-300/15 text-amber-200":"bg-white/10 text-blue-100"}`}><Icon name={icon} className="h-4 w-4"/></span><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.13em] text-blue-100/50">{label}</p><p className="mt-0.5 truncate text-xl font-black tracking-tight text-white sm:text-2xl">{value}</p></div></div>}
function MetricLink({href,label,value,icon,alert,tone}:{href:string;label:string;value:string;icon:string;alert:boolean;tone:"green"|"red"}){const active=alert?(tone==="green"?"bg-emerald-400/15 hover:bg-emerald-400/20":"bg-rose-500/15 hover:bg-rose-500/20"):"hover:bg-white/5";return <Link href={href} className={`flex items-center gap-3 border-b border-white/10 p-4 transition sm:p-5 sm:border-b-0 sm:border-r ${active}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${alert?(tone==="green"?"bg-emerald-300/15 text-emerald-100":"bg-rose-400/20 text-rose-100"):"bg-white/10 text-blue-100"}`}><Icon name={icon} className="h-4 w-4"/></span><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.13em] text-blue-100/55">{label}</p><p className="mt-0.5 truncate text-xl font-black tracking-tight text-white sm:text-2xl">{value}</p></div></Link>}
function CompanyPaymentMetric({count,amount}:{count:number;amount:number}){const pending=count>0;return <Link href="/insurance/company-payments" className={`group flex items-center gap-3 p-4 transition sm:p-5 ${pending?"bg-rose-500/25 hover:bg-rose-500/32":"bg-emerald-400/10 hover:bg-emerald-400/15"}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${pending?"bg-rose-400/20 text-rose-100":"bg-emerald-300/15 text-emerald-100"}`}><Icon name="credit" className="h-4 w-4"/></span><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.13em] text-blue-100/65">Company Payment</p><p className="mt-0.5 truncate text-xl font-black tracking-tight text-white sm:text-2xl">{money(amount)}</p><p className={`mt-0.5 text-[9px] font-black ${pending?"text-rose-100":"text-emerald-100"}`}>{pending?`${count} pending · Pay now →`:"All clear"}</p></div></Link>}
function MoneyCard({label,value,copy,href,tone}:{label:string;value:string;copy:string;href:string;tone:"green"|"red"|"blue"|"amber"}){const toneClass=tone==="green"?"text-emerald-700":tone==="red"?"text-rose-700":tone==="amber"?"text-amber-700":"text-blue-700";return <Link href={href} className="rounded-[22px] border border-[#dbe6f3] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-2 text-2xl font-black ${toneClass}`}>{value}</p><p className="mt-1 text-xs font-semibold text-slate-400">{copy}</p></Link>}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-white/10 bg-white/[.06] p-3"><p className="text-[8px] font-black uppercase tracking-[.13em] text-blue-100/45">{label}</p><p className="mt-1 text-base font-black text-white">{value}</p></div>}
