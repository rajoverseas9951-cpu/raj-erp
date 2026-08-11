'use client';

import { useEffect, useState } from 'react';
import { accountingApi, TrialBalance } from '@/lib/accounting';
import { businessReportsApi, BusinessOverview } from '@/lib/business-reports';

const money=(n:number|string|undefined)=>`₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const assetGroups=['Bank Accounts','Cash-in-Hand','Fixed Assets','Current Assets','Sundry Debtors'];
const liabilityGroups=['Loans & Liabilities','Capital Account','Sundry Creditors'];

export default function BalanceSheetPage(){
 const [trial,setTrial]=useState<TrialBalance|null>(null); const [overview,setOverview]=useState<BusinessOverview|null>(null); const [error,setError]=useState('');
 useEffect(()=>{Promise.all([accountingApi.trialBalance(),businessReportsApi.overview()]).then(([t,o])=>{setTrial(t);setOverview(o)}).catch(e=>setError(e instanceof Error?e.message:'Balance sheet load nahi hui.'))},[]);
 const assets=(trial?.rows||[]).filter(r=>assetGroups.includes(r.ledger_group)).map(r=>({...r,balance:Number(r.debit)-Number(r.credit)}));
 const liabilities=(trial?.rows||[]).filter(r=>liabilityGroups.includes(r.ledger_group)).map(r=>({...r,balance:Number(r.credit)-Number(r.debit)}));
 const assetsTotal=assets.reduce((n,r)=>n+r.balance,0); const liabilitiesBase=liabilities.reduce((n,r)=>n+r.balance,0); const currentProfit=Number(overview?.total_business_profit||0); const liabilitiesTotal=liabilitiesBase+currentProfit; const difference=assetsTotal-liabilitiesTotal;
 return <main className="min-h-screen bg-[#eef4fb] p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1450px] space-y-6">
  <section className="rounded-[30px] bg-[linear-gradient(125deg,#06152f,#0b2f6b_55%,#1769e0)] p-7 text-white shadow-[0_28px_75px_rgba(7,26,60,.22)]"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.24em] text-cyan-300">Financial Statement</p><h1 className="mt-2 text-4xl font-black">Balance Sheet</h1><p className="mt-2 text-sm text-blue-100/80">Assets, liabilities, capital and current business profit in one view.</p></div><div className="flex gap-2"><a href="/accounts" className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black">Accounts</a><button onClick={()=>window.print()} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#0b2f6b]">Print</button></div></div></section>
  {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div>}
  <section className="grid gap-4 md:grid-cols-4"><Card label="Total Assets" value={money(assetsTotal)}/><Card label="Liabilities + Capital" value={money(liabilitiesBase)}/><Card label="Current Profit" value={money(currentProfit)}/><Card label="Difference" value={money(difference)} danger={Math.abs(difference)>.01}/></section>
  <section className="grid gap-6 lg:grid-cols-2"><Side title="Assets" total={assetsTotal} rows={assets.map(r=>[r.ledger_name,r.ledger_group,r.balance])}/><Side title="Liabilities & Capital" total={liabilitiesTotal} rows={[...liabilities.map(r=>[r.ledger_name,r.ledger_group,r.balance] as [string,string,number]),['Current Business Profit','Current Year Earnings',currentProfit]]}/></section>
  <div className={`rounded-2xl border p-4 text-sm font-bold ${Math.abs(difference)<=.01?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-amber-200 bg-amber-50 text-amber-800'}`}>{Math.abs(difference)<=.01?'Balance sheet is balanced.':'Balance sheet difference exists. Review opening balances and unposted vouchers.'}</div>
 </div></main>
}
function Card({label,value,danger=false}:{label:string;value:string;danger?:boolean}){return <div className={`rounded-[24px] border bg-white p-5 shadow-sm ${danger?'border-amber-200':'border-[#dce7f4]'}`}><p className="text-[10px] font-black uppercase tracking-[.15em] text-blue-500">{label}</p><p className="mt-2 text-2xl font-black text-[#0a2147]">{value}</p></div>}
function Side({title,total,rows}:{title:string;total:number;rows:Array<[string,string,number]>}){return <section className="overflow-hidden rounded-[26px] border border-[#dce7f4] bg-white shadow-sm"><div className="flex items-center justify-between border-b bg-gradient-to-r from-[#fbfdff] to-[#eef5ff] px-6 py-5"><h2 className="text-xl font-black text-[#10213f]">{title}</h2><span className="font-black text-[#174b98]">{money(total)}</span></div><div>{rows.length?rows.map(([name,group,balance])=><div key={`${name}-${group}`} className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-100 px-6 py-4 last:border-0"><div><p className="font-bold text-[#10213f]">{name}</p><p className="text-xs font-semibold text-slate-400">{group}</p></div><p className="font-black text-slate-700">{money(balance)}</p></div>):<div className="p-8 text-center font-semibold text-slate-400">No balances</div>}</div></section>}
