'use client';

import { useEffect,useState } from 'react';
import { accountingApi } from '@/lib/accounting';
import { businessReportsApi,BusinessOverview } from '@/lib/business-reports';
import { financeControlApi,OutstandingPayload } from '@/lib/finance-control';

const money=(n:number|string|undefined)=>`₹${Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;

export default function AccountsPage(){
 const[pl,setPl]=useState<{income:number;expense:number;net_profit:number}|null>(null);const[bs,setBs]=useState<{assets:number;liabilities:number;difference:number}|null>(null);const[business,setBusiness]=useState<BusinessOverview|null>(null);const[out,setOut]=useState<OutstandingPayload|null>(null);const[error,setError]=useState('');
 useEffect(()=>{Promise.all([accountingApi.profitLoss(),accountingApi.balanceSheet(),businessReportsApi.overview(),financeControlApi.outstanding()]).then(([p,b,r,o])=>{setPl(p);setBs(b);setBusiness(r);setOut(o)}).catch(e=>setError(e instanceof Error?e.message:'Accounts could not load.'))},[]);
 const actions=[
  ['Cash & Bank Entry','/accounts/cash-bank','Record money received, money paid and office expense.','₹'],
  ['Party Balance','/accounts/outstanding','See customer receivable and agent/vendor payable.','PB'],
  ['Insurance Accounts','/accounts/insurance','Track company/source commission settlement.','IN'],
  ['Account Heads','/accounts/ledgers','Manage cash, bank, customer, expense and income accounts.','AH'],
  ['Opening Balance & Year Lock','/accounts/setup','Set opening figures and lock completed financial year.','FY'],
  ['Profit & Loss','/reports/profit-loss','Yearly income, expense and net business profit.','PL'],
  ['Balance Sheet','/reports/balance-sheet','Assets, liabilities and year-end financial position.','BS'],
  ['All Reports','/reports','Insurance, RTO and financial reports.','RP'],
 ] as const;
 return <main className="min-h-screen bg-[#eef4fb] p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1500px] space-y-6">
  <section className="rounded-[30px] bg-[linear-gradient(125deg,#06152f,#0b2f6b_55%,#1769e0)] p-7 text-white shadow-[0_28px_75px_rgba(7,26,60,.22)]"><p className="text-[10px] font-black uppercase tracking-[.24em] text-cyan-300">Business Accounts</p><h1 className="mt-2 text-4xl font-black">Accounts</h1><p className="mt-2 max-w-3xl text-sm text-blue-100/80">Simple daily हिसाब for insurance and RTO work. No debit-credit knowledge required for routine entries.</p></section>
  {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div>}
  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><Card title="Business Profit" value={money(business?.total_business_profit)} sub="Insurance + RTO"/><Card title="To Receive" value={money((out?.summary.party_receivable||0)+(out?.summary.insurance_commission_due||0)+(out?.summary.service_customer_due||0))} sub="Pending collections"/><Card title="To Pay" value={money(out?.summary.party_payable)} sub="Party/agent payable"/><Card title="Income" value={money(pl?.income)} sub="Current accounts"/><Card title="Expense" value={money(pl?.expense)} sub="Current accounts"/><Card title="Balance Difference" value={money(bs?.difference)} sub="Target: ₹0"/></section>
  <section><div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">Quick access</p><h2 className="mt-1 text-2xl font-black text-[#0b2d61]">What do you want to do?</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{actions.map(([title,href,copy,icon])=><a key={href} href={href} className="group rounded-[24px] border border-[#dce7f4] bg-white p-5 shadow-[0_12px_35px_rgba(20,53,102,.07)] transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#0b2f6b] to-[#2a72e8] text-xs font-black text-white">{icon}</span><p className="mt-4 text-lg font-black text-[#0a2147]">{title} <span className="text-blue-500">→</span></p><p className="mt-2 text-xs font-semibold leading-relaxed text-slate-400">{copy}</p></a>)}</div></section>
  <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5"><p className="text-sm font-black text-amber-900">Year-end rule</p><p className="mt-1 text-xs font-semibold leading-relaxed text-amber-800/80">Before locking the year, verify Cash/Bank, Party Balance, Insurance Commission Due, Profit & Loss and Balance Sheet. Balance Sheet difference should ideally be zero.</p></section>
 </div></main>
}
function Card({title,value,sub}:{title:string;value:string;sub:string}){return <div className="rounded-[22px] border border-[#dce7f4] bg-white p-4 shadow-sm"><p className="text-[9px] font-black uppercase tracking-[.14em] text-blue-500">{title}</p><p className="mt-2 truncate text-xl font-black text-[#0a2147]">{value}</p><p className="mt-1 text-[10px] font-semibold text-slate-400">{sub}</p></div>}
