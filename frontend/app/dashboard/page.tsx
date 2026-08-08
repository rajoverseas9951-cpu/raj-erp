"use client";
import Link from "next/link";
import { useCallback,useEffect,useRef,useState } from "react";
import { Icon } from "@/components/dashboard/Icon";
import { DashboardPeriod,DashboardSummary,getDashboardSummary } from "@/lib/dashboard-api";
import { DASHBOARD_REFRESH_EVENT } from "@/lib/dashboard-refresh";
import { DASHBOARD_PERIODS,dashboardPeriodLabel } from "@/lib/dashboard-periods";

const money=(v=0)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(v);
const num=(v=0)=>v.toLocaleString("en-IN");
const actions=[["New vehicle","/vehicles/new","vehicle","Add RC & vehicle"],["New customer","/customers/new","customers","Create client"],["Insurance","/vehicles","shield","Add / renew policy"],["RTO work","/vehicles","building","Start process"],["Payment","/accounts","credit","Receive amount"]] as const;

export default function DashboardPage(){
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(new Date());
  const[data,setData]=useState<DashboardSummary>();
  const[error,setError]=useState("");
  const[refreshing,setRefreshing]=useState(false);
  const[period,setPeriod]=useState<DashboardPeriod>("today");
  const[dateFrom,setDateFrom]=useState(today);
  const[dateTo,setDateTo]=useState(today);
  const req=useRef<AbortController|null>(null);

  const refresh=useCallback(()=>{
    if(period==="custom"&&(!dateFrom||!dateTo||dateFrom>dateTo)){setError("Select a valid date range.");return Promise.resolve();}
    req.current?.abort();const c=new AbortController();req.current=c;setRefreshing(true);setError("");
    return getDashboardSummary({period,dateFrom,dateTo},c.signal).then(setData).catch(e=>{
      if(e instanceof DOMException&&e.name==="AbortError")return;
      if(e instanceof Error&&e.message==="AUTH_REQUIRED"){sessionStorage.removeItem("raj_erp_token");location.replace("/login?next=/dashboard");return;}
      setError(e instanceof Error?e.message:"Dashboard could not refresh.");
    }).finally(()=>{if(req.current===c){setRefreshing(false);req.current=null;}})
  },[period,dateFrom,dateTo]);

  useEffect(()=>{void refresh();const r=()=>void refresh();window.addEventListener("focus",r);window.addEventListener(DASHBOARD_REFRESH_EVENT,r);return()=>{req.current?.abort();window.removeEventListener("focus",r);window.removeEventListener(DASHBOARD_REFRESH_EVENT,r)}},[refresh]);

  const work=Object.entries(data?.work??{}).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const vehicles=data?.kpis.vehicles?.value??0;
  const policies=data?.kpis.active_policies?.value??0;
  const due=data?.kpis.expiring_policies?.value??0;
  const outstanding=data?.kpis.outstanding_amount?.value??0;
  const totalWork=work.reduce((s,[,v])=>s+v,0);

  return <main className="min-h-screen bg-[#f4f7fc] pb-10 dark:bg-[#050914]">
    <div className="mx-auto max-w-[1560px] space-y-4 p-4 sm:p-6 lg:p-7">

      <section className="relative overflow-hidden rounded-[30px] border border-[#173d78]/40 bg-[#071a3c] text-white shadow-[0_28px_80px_-34px_rgba(7,26,60,.65)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,rgba(43,117,255,.55),transparent_28%),radial-gradient(circle_at_70%_100%,rgba(47,208,255,.16),transparent_26%),linear-gradient(125deg,#06152f_5%,#0a2555_58%,#103fa5_100%)]"/>
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border border-white/10"/>
        <div className="absolute -right-2 top-10 h-36 w-36 rounded-full border border-white/10"/>
        <div className="relative p-5 sm:p-7 lg:p-8">
          <div className="grid gap-7 xl:grid-cols-[1.15fr_.85fr] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[9px] font-black uppercase tracking-[.22em] text-cyan-200">Raj Insurance ERP</span>
                <span className="text-xs font-semibold text-blue-100/65">Live operations workspace</span>
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-[-.045em] sm:text-5xl">Today&apos;s workspace</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/72 sm:text-base">Vehicles, customers, renewals, RTO work and collections — your important work in one clean view.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-5">
              {actions.map(([label,href,icon,copy])=><Link key={label} href={href} className="group rounded-2xl border border-white/10 bg-white/[.08] p-3 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/[.14]">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-[#0a2b64] shadow-lg shadow-blue-950/10"><Icon name={icon} className="h-4 w-4"/></span>
                <span className="mt-3 block text-xs font-black text-white">{label}</span>
                <span className="mt-0.5 hidden text-[9px] font-semibold text-blue-100/55 xl:block">{copy}</span>
              </Link>)}
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <HeroStat label="Vehicles" value={num(vehicles)} icon="vehicle"/>
            <HeroStat label="Active policies" value={num(policies)} icon="shield"/>
            <HeroStat label="Due soon" value={num(due)} icon="clock" alert={due>0}/>
            <HeroStat label="Outstanding" value={money(outstanding)} icon="wallet" alert={outstanding>0}/>
          </div>
        </div>
      </section>

      {error&&<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <article className="overflow-hidden rounded-[26px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.07)] dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/60 px-5 py-5 sm:px-6 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-600">Attention</p>
              <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Today&apos;s work</h2>
              <p className="mt-1 text-xs text-slate-400">Items that need follow-up first.</p>
            </div>
            <span className="grid h-11 min-w-11 place-items-center rounded-2xl bg-[#0b2b62] px-3 text-sm font-black text-white shadow-lg shadow-blue-900/15">{totalWork}</span>
          </div>

          <div className="p-3 sm:p-4">
            {work.length?<div className="grid gap-2 sm:grid-cols-2">{work.slice(0,6).map(([label,value],index)=><Link href="/vehicles" key={label} className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-[#f9fbff] p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60 dark:border-slate-800 dark:bg-slate-950/40">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-blue-700 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800"><Icon name={index%2===0?"clock":"building"} className="h-4 w-4"/></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black capitalize text-slate-900 dark:text-white">{label.replaceAll("_"," ")}</span><span className="mt-0.5 block text-[10px] font-semibold text-slate-400">Open items requiring follow-up</span></span>
              <span className="rounded-xl bg-white px-3 py-2 text-sm font-black text-[#0b2b62] shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">{value}</span>
            </Link>)}</div>:<div className="grid min-h-56 place-items-center text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Icon name="shield" className="h-6 w-6"/></div><p className="mt-4 text-base font-black text-slate-900 dark:text-white">All clear</p><p className="mt-1 text-xs text-slate-400">No pending work in this view.</p></div></div>}
          </div>
        </article>

        <aside className="overflow-hidden rounded-[26px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.07)] dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-[#081b3f] p-5 text-white dark:border-slate-800">
            <p className="text-[9px] font-black uppercase tracking-[.22em] text-cyan-300">Reporting view</p>
            <h2 className="mt-1 text-2xl font-black">{dashboardPeriodLabel(period)}</h2>
            <p className="mt-1 text-xs text-blue-100/60">Switch the dashboard period without leaving this screen.</p>
          </div>
          <div className="p-5">
            <label className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Period<select value={period} onChange={e=>setPeriod(e.target.value as DashboardPeriod)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black normal-case tracking-normal text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white">{DASHBOARD_PERIODS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            {period==="custom"&&<div className="mt-3 grid grid-cols-2 gap-2"><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800"/><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800"/></div>}
            <button onClick={()=>void refresh()} disabled={refreshing} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-[#0b2b62] to-[#2563eb] px-4 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(37,99,235,.22)] transition hover:-translate-y-0.5 disabled:opacity-50">{refreshing?"Refreshing…":"Refresh Dashboard"}</button>
            <Link href="/reports" className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-[#f9fbff] px-4 py-3 text-sm font-black text-slate-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><span>Open full reports</span><span>→</span></Link>
          </div>
        </aside>
      </section>
    </div>
  </main>
}

function HeroStat({label,value,icon,alert=false}:{label:string;value:string;icon:string;alert?:boolean}){
  return <div className="rounded-2xl border border-white/10 bg-black/[.10] p-4 backdrop-blur">
    <div className="flex items-center justify-between gap-3"><span className={`grid h-9 w-9 place-items-center rounded-xl ${alert?"bg-amber-300/15 text-amber-200":"bg-white/10 text-blue-100"}`}><Icon name={icon} className="h-4 w-4"/></span><span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wide ${alert?"bg-amber-300/15 text-amber-200":"bg-emerald-300/10 text-emerald-200"}`}>{alert?"Attention":"Live"}</span></div>
    <p className="mt-4 text-[10px] font-bold text-blue-100/55">{label}</p>
    <p className="mt-1 truncate text-2xl font-black tracking-tight text-white sm:text-3xl">{value}</p>
  </div>
}
