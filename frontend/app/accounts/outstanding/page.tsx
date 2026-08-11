'use client';

import { useEffect,useMemo,useState } from 'react';
import { financeControlApi,OutstandingPayload } from '@/lib/finance-control';

const money=(n:number|string|undefined)=>`₹${Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;

export default function OutstandingPage(){
 const[data,setData]=useState<OutstandingPayload|null>(null);const[search,setSearch]=useState('');const[error,setError]=useState('');
 useEffect(()=>{financeControlApi.outstanding().then(setData).catch(e=>setError(e instanceof Error?e.message:'Outstanding could not load.'))},[]);
 const rows=useMemo(()=>data?.rows.filter(r=>!search||r.name.toLowerCase().includes(search.toLowerCase()))??[],[data,search]);
 return <main className="min-h-screen bg-[#f3f7fc] p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1400px] space-y-5">
  <section className="rounded-[30px] bg-gradient-to-br from-[#07172f] via-[#0d3474] to-[#2167df] p-7 text-white shadow-xl"><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200">Daily Control</p><h1 className="mt-2 text-4xl font-black">Party Balance</h1><p className="mt-2 text-sm text-blue-100/80">One screen for customer receivable, party payable and pending service collections.</p></section>
  {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div>}
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card label="Party Receivable" value={money(data?.summary.party_receivable)} copy="Money to collect"/><Card label="Party Payable" value={money(data?.summary.party_payable)} copy="Money to pay"/><Card label="Insurance Commission Due" value={money(data?.summary.insurance_commission_due)} copy="Company/source se lena"/><Card label="Service Customer Due" value={money(data?.summary.service_customer_due)} copy="RTO/licence/passport pending"/></section>
  <section className="overflow-hidden rounded-[26px] border border-[#dbe6f3] bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="text-xl font-black text-[#0b2d61]">Party-wise Closing Balance</h2><p className="mt-1 text-xs text-slate-500">Positive receivable means money has to come in. Payable means money has to go out.</p></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search party…" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400"/></div>
   <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-[#f8fbff] text-left text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="p-4">Party</th><th className="p-4">Type</th><th className="p-4">To Receive</th><th className="p-4">To Pay</th><th className="p-4">Action</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id} className="border-t"><td className="p-4 font-black text-[#123b78]">{r.name}</td><td className="p-4 text-slate-500">{r.group}</td><td className="p-4 font-black text-emerald-700">{r.receivable?money(r.receivable):'—'}</td><td className="p-4 font-black text-rose-700">{r.payable?money(r.payable):'—'}</td><td className="p-4"><a href="/accounts/cash-bank" className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">Record Payment</a></td></tr>):<tr><td colSpan={5} className="p-10 text-center font-semibold text-slate-400">No outstanding party balance.</td></tr>}</tbody></table></div>
  </section>
 </div></main>
}
function Card({label,value,copy}:{label:string;value:string;copy:string}){return <div className="rounded-[22px] border border-[#dbe6f3] bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-blue-500">{label}</p><p className="mt-2 text-2xl font-black text-[#0b2d61]">{value}</p><p className="mt-1 text-xs text-slate-400">{copy}</p></div>}
