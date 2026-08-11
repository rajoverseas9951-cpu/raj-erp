'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { businessReportsApi, BusinessOverview } from '@/lib/business-reports';

const money=(n:number|undefined)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n||0));
const reports=[
  ['Expiry Report','Track insurance, PUC, fitness, permit and tax renewals.','/reports/expiry','EX'],
  ['Agent Report','Insurance + RTO agent workload and payable summary.','/reports/agent','AG'],
  ['Broker Report','Broker-wise RTO work, billing and profit.','/reports/broker','BR'],
  ['Insurance Report','Policy-wise premium, customer payment and earning.','/reports/insurance','IN'],
  ['Insurance Commission','Company/source-wise gross and net commission.','/reports/insurance-commission','IC'],
  ['Insurance Due','Pending customer insurance payment report.','/reports/insurance-due','ID'],
  ['RTO Work Report','RTO, PUC, fitness, permit, tax, HSRP, SLD, transfer, licence and passport work.','/reports/rto-work','RT'],
  ['RTO Profit Report','Category-wise billing, cost and net profit including licence and passport.','/reports/rto-profit','RP'],
  ['HSRP Report','HSRP order, delivery, billing and cost register.','/reports/hsrp','HS'],
  ['Vehicle Report','Vehicle/customer master report with compliance status.','/reports/vehicle','VE'],
  ['Agent Work Report','Detailed RTO work assigned to agents.','/reports/agent-work','AW'],
  ['Balance Sheet','Assets, liabilities and accounting difference.','/reports/balance-sheet','BS'],
  ['Profit & Loss','Income, expense and current net profit.','/reports/profit-loss','PL'],
  ['Trial Balance','All ledger debit and credit closing balances.','/reports/trial-balance','TB'],
  ['Day Book','Chronological transaction register.','/reports/day-book','DB'],
] as const;

export default function ReportsPage(){
  const [data,setData]=useState<BusinessOverview|null>(null); const [error,setError]=useState('');
  useEffect(()=>{businessReportsApi.overview().then(setData).catch(e=>setError(e instanceof Error?e.message:'Report summary load nahi hua.'))},[]);
  const stats=[['Insurance Policies',String(data?.policy_count||0)],['Insurance Commission',money(data?.insurance_commission)],['Insurance Profit',money(data?.insurance_profit)],['RTO Work',String(data?.rto_work_count||0)],['RTO Billing',money(data?.rto_billing)],['RTO Profit',money(data?.rto_profit)],['Total Business Profit',money(data?.total_business_profit)]];
  return <main className="min-h-screen bg-[#f3f7fc] p-4 text-slate-950 md:p-6">
    <div className="mx-auto max-w-[1600px] space-y-6">
      <section className="overflow-hidden rounded-[32px] bg-gradient-to-br from-[#06132f] via-[#103579] to-[#2469e8] p-7 text-white shadow-2xl md:p-9"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[.26em] text-cyan-200">Business Intelligence</p><h1 className="mt-2 text-4xl font-black">Report Master</h1><p className="mt-2 max-w-3xl text-sm text-blue-100">Insurance is reported separately. RTO business consolidates vehicle RTO work, PUC, Fitness, Permit, Tax, HSRP, SLD, Transfer, Driving Licence and Passport services.</p></div><Link href="/accounts" className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 font-black backdrop-blur">Open Accounts</Link></div></section>
      {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{error}</div>}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{stats.map(([k,v])=><article key={k} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{k}</p><p className="mt-2 text-xl font-black text-[#0d2d61]">{v}</p></article>)}</section>
      <section><div className="mb-4"><p className="text-xs font-black uppercase tracking-[.2em] text-blue-600">All Reports</p><h2 className="mt-1 text-2xl font-black">Choose a report</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{reports.map(([title,copy,href,icon])=><Link key={href} href={href} className="group flex items-center gap-4 rounded-[24px] border bg-white p-5 shadow-[0_12px_35px_rgba(15,43,86,.06)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-xl"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-xs font-black text-white shadow-lg">{icon}</span><span className="min-w-0"><strong className="block text-base font-black text-[#102b59]">{title}</strong><span className="mt-1 block text-xs leading-relaxed text-slate-500">{copy}</span></span><span className="ml-auto text-xl font-black text-blue-500 transition group-hover:translate-x-1">→</span></Link>)}</div></section>
    </div>
  </main>;
}
