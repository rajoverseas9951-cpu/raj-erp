"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/dashboard/Icon";
import { DashboardPeriod, DashboardSummary, getDashboardSummary } from "@/lib/dashboard-api";
import { DASHBOARD_PERIODS, dashboardPeriodLabel } from "@/lib/dashboard-periods";
import { financeControlApi, OutstandingPayload } from "@/lib/finance-control";
import { organizationApi } from "@/lib/organization";
import { ERP_MODULE_KEYS, ErpModuleKey } from "@/lib/erp-modules";

const money=(v=0)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(v);
const num=(v=0)=>v.toLocaleString("en-IN");

type Tile={title:string;value:string;note:string;href?:string;icon:string;module?:ErpModuleKey};
type Action={title:string;note:string;href:string;icon:string;module?:ErpModuleKey};

const actions:Action[]=[
 {title:"Motor policy",note:"Issue / renew",href:"/insurance/motor",icon:"shield",module:"POLICIES"},
 {title:"New customer",note:"Create profile",href:"/customers/new",icon:"customers",module:"CUSTOMERS"},
 {title:"New vehicle",note:"Add RC / vehicle",href:"/vehicles/new",icon:"vehicle",module:"VEHICLES"},
 {title:"Receive / Pay",note:"Cash & bank",href:"/accounts/cash-bank",icon:"credit",module:"ACCOUNTING"},
 {title:"Claims",note:"Open claim desk",href:"/claims",icon:"reports",module:"CLAIMS"},
 {title:"Reports",note:"Business reports",href:"/reports",icon:"reports",module:"REPORTS"},
];

export default function DashboardPage(){
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(new Date());
 const [data,setData]=useState<DashboardSummary>();
 const [balances,setBalances]=useState<OutstandingPayload|null>(null);
 const [enabled,setEnabled]=useState<Set<string>>(new Set(ERP_MODULE_KEYS));
 const [modulesReady,setModulesReady]=useState(false);
 const [period,setPeriod]=useState<DashboardPeriod>("today");
 const [dateFrom,setDateFrom]=useState(today); const [dateTo,setDateTo]=useState(today);
 const [loading,setLoading]=useState(true); const [error,setError]=useState("");
 const req=useRef<AbortController|null>(null);
 const on=(key:ErpModuleKey)=>enabled.has(key);

 useEffect(()=>{organizationApi.get().then(org=>{
   const modules=org.modules;
   if(modules?.length)setEnabled(new Set(modules.filter(m=>m.allowed&&m.enabled).map(m=>m.key)));
 }).catch(()=>undefined).finally(()=>setModulesReady(true));},[]);

 const refresh=useCallback(async()=>{
   if(period==="custom"&&(!dateFrom||!dateTo||dateFrom>dateTo)){setError("Select a valid date range.");return;}
   req.current?.abort(); const controller=new AbortController(); req.current=controller; setLoading(true); setError("");
   try{
     const summary=await getDashboardSummary({period,dateFrom,dateTo},controller.signal); setData(summary);
     if(enabled.has("ACCOUNTING")){
       try{setBalances(await financeControlApi.outstanding());}catch{setBalances(null);}
     }else setBalances(null);
   }catch(e){if(e instanceof DOMException&&e.name==="AbortError")return;setError(e instanceof Error?e.message:"Dashboard could not refresh.");}
   finally{if(req.current===controller){req.current=null;setLoading(false);}}
 },[period,dateFrom,dateTo,enabled]);

 useEffect(()=>{if(!modulesReady)return;void refresh();return()=>req.current?.abort();},[modulesReady,refresh]);

 const tiles=useMemo<Tile[]>(()=>{
   const out:Tile[]=[];
   if(on("CUSTOMERS"))out.push({title:"Customers",value:num(data?.kpis.customers?.value??0),note:"Customer master",href:"/customers",icon:"customers",module:"CUSTOMERS"});
   if(on("VEHICLES"))out.push({title:"Vehicles",value:num(data?.kpis.vehicles?.value??0),note:"Vehicle master",href:"/vehicles",icon:"vehicle",module:"VEHICLES"});
   if(on("POLICIES")){
     out.push({title:"Active policies",value:num(data?.kpis.active_policies?.value??0),note:"Insurance portfolio",href:"/insurance",icon:"shield",module:"POLICIES"});
     out.push({title:"Renewals due",value:num(data?.kpis.expiring_policies?.value??0),note:"Expiry pipeline",href:"/reports/expiry",icon:"reports",module:"POLICIES"});
   }
   if(on("CLAIMS"))out.push({title:"Claims work",value:num(Number(data?.work?.claims_pending??data?.work?.claims??0)),note:"Pending claim activity",href:"/claims",icon:"reports",module:"CLAIMS"});
   if(on("RTO"))out.push({title:"RTO work",value:num(Number(data?.work?.rto_pending??data?.work?.rto??0)),note:"Vehicle service work",href:"/vehicles",icon:"building",module:"RTO"});
   return out;
 },[data,enabled]);

 const receivable=Number(balances?.summary.total_receivable??data?.kpis.outstanding_amount?.value??data?.revenue.outstanding??0);
 const payable=Number(balances?.summary.party_payable??0);
 const commission=Number(balances?.summary.insurance_commission_due??0);
 const activeActions=actions.filter(a=>!a.module||on(a.module));
 const nothingBusiness=!on("CUSTOMERS")&&!on("VEHICLES")&&!on("POLICIES")&&!on("CLAIMS")&&!on("RTO")&&!on("ACCOUNTING")&&!on("REPORTS");

 return <main className="min-h-screen bg-[#f4f7fc] p-4 text-[#17233d] dark:bg-[#070b13] dark:text-slate-100 sm:p-6 lg:p-8">
   <div className="mx-auto max-w-[1580px]">
     <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
       <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">Live business command center</p><h1 className="mt-1 text-3xl font-black tracking-[-.04em]">Dashboard</h1><p className="mt-1 text-sm text-slate-500">Only enabled ERP modules are shown here.</p></div>
       <div className="flex flex-wrap gap-2 rounded-2xl border border-white bg-white/90 p-2 shadow-sm dark:border-white/10 dark:bg-white/[.05]">
         <select value={period} onChange={e=>setPeriod(e.target.value as DashboardPeriod)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-white/10 dark:bg-white/[.05]">{DASHBOARD_PERIODS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select>
         <button onClick={()=>void refresh()} className="rounded-xl bg-[#10264b] px-4 py-2 text-xs font-bold text-white">{loading?"Refreshing…":"Refresh"}</button>
         {on("REPORTS")&&<Link href="/reports" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold dark:border-white/10 dark:bg-white/[.05]">Reports</Link>}
       </div>
     </header>

     {period==="custom"&&<div className="mt-4 grid gap-2 rounded-2xl bg-white p-3 shadow-sm sm:grid-cols-3 dark:bg-white/[.05]"><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="rounded-xl border p-2 text-xs dark:bg-transparent"/><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="rounded-xl border p-2 text-xs dark:bg-transparent"/><button onClick={()=>void refresh()} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white">Apply</button></div>}
     {error&&<div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

     {nothingBusiness?<section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-white/10 dark:bg-white/[.05]"><h2 className="text-xl font-black">No operational modules enabled</h2><p className="mt-2 text-sm text-slate-500">Enable modules from Settings → Modules to build this dashboard.</p><Link href="/settings/modules" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">Open Module Settings</Link></section>:<>
       {on("ACCOUNTING")&&<section className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_.6fr]">
         <article className="overflow-hidden rounded-[30px] bg-[#07162f] p-7 text-white shadow-xl"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-200">Finance position</p><p className="mt-1 text-xs text-white/50">{dashboardPeriodLabel(period)}</p></div><Link href="/accounts/outstanding" className="rounded-full bg-white/10 px-3 py-2 text-[10px] font-bold">Open outstanding →</Link></div><p className="mt-6 text-5xl font-black tracking-[-.06em] sm:text-6xl">{money(receivable)}</p><p className="mt-2 text-xs text-white/50">Total receivable</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><FinanceMini label="Payable" value={money(payable)}/><FinanceMini label="Commission due" value={money(commission)}/><FinanceMini label="Net result" value={money(data?.revenue.net_result??0)}/></div></article>
         <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[.05]"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Accounting</p><h2 className="mt-2 text-xl font-black">Finance desk</h2><div className="mt-5 space-y-2"><DeskLink href="/accounts/cash-bank" label="Cash & bank entry"/><DeskLink href="/accounts/outstanding" label="Receivable / payable"/><DeskLink href="/accounts" label="Accounts overview"/></div></article>
       </section>}

       <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{tiles.map(t=><Link key={t.title} href={t.href??"#"} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/[.05]"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 dark:bg-white/10"><Icon name={t.icon} className="h-4 w-4"/></span><Icon name="arrow" className="h-3.5 w-3.5 text-slate-400"/></div><p className="mt-5 text-[10px] font-black uppercase tracking-[.14em] text-slate-400">{t.title}</p><p className="mt-1 text-3xl font-black tracking-[-.04em]">{t.value}</p><p className="mt-1 text-xs text-slate-500">{t.note}</p></Link>)}</section>

       <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[.05]"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Quick actions</p><h2 className="mt-1 text-xl font-black">Enabled workspace</h2></div><Link href="/settings/modules" className="text-xs font-bold text-blue-600">Manage modules →</Link></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{activeActions.map(a=><Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[.04]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 dark:bg-white/10"><Icon name={a.icon} className="h-4 w-4"/></span><span><strong className="block text-sm">{a.title}</strong><small className="text-slate-500">{a.note}</small></span></Link>)}</div></section>
     </>}
   </div>
 </main>;
}

function FinanceMini({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-white/[.07] p-4"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/45">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>}
function DeskLink({href,label}:{href:string;label:string}){return <Link href={href} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold dark:border-white/10"><span>{label}</span><Icon name="arrow" className="h-3.5 w-3.5"/></Link>}
