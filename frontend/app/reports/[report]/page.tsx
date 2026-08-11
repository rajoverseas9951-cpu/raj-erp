'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { accountingApi } from '@/lib/accounting';
import { businessReportsApi, ReportPayload } from '@/lib/business-reports';
import { exportRowsToExcel, exportRowsToPdf } from '@/lib/export-utils';

const titles: Record<string,string> = {
  expiry:'Expiry Report', agent:'Agent Report', broker:'Broker Report', insurance:'Insurance Report',
  'insurance-commission':'Insurance Commission Report', 'insurance-due':'Insurance Due Report',
  'rto-work':'RTO Work Report', 'rto-profit':'RTO Profit Report', hsrp:'HSRP Report', vehicle:'Vehicle Report',
  'agent-work':'Agent Work Report', 'balance-sheet':'Balance Sheet', 'profit-loss':'Profit & Loss',
  'trial-balance':'Trial Balance', 'day-book':'Day Book',
};
const moneyKeys = /(amount|premium|commission|billing|cost|profit|payable|received|due|discount|debit|credit|balance|assets|liabilities|income|expense)/i;
const hideKeys = new Set(['id']);
const label=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase());
const money=(value:unknown)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(value||0));
const display=(key:string,value:unknown)=>moneyKeys.test(key)&&typeof value!=='string'?money(value):(value===null||value===undefined||value===''?'—':String(value));

export default function ReportDetailPage(){
  const {report}=useParams<{report:string}>();
  const [data,setData]=useState<ReportPayload>({rows:[],summary:{}});
  const [from,setFrom]=useState(''); const [to,setTo]=useState(''); const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [exporting,setExporting]=useState('');
  async function load(){
    setLoading(true); setError(''); const filters={from:from||undefined,to:to||undefined,search:search||undefined};
    try{
      let payload:ReportPayload;
      switch(report){
        case 'expiry': payload=await businessReportsApi.expiry(filters); break;
        case 'agent': payload=await businessReportsApi.agents(filters); break;
        case 'broker': payload=await businessReportsApi.brokers(filters); break;
        case 'insurance': payload=await businessReportsApi.insurance(filters); break;
        case 'insurance-commission': payload=await businessReportsApi.insuranceCommission(filters); break;
        case 'insurance-due': payload=await businessReportsApi.insuranceDue(filters); break;
        case 'rto-work': payload=await businessReportsApi.rtoWork(filters); break;
        case 'rto-profit': payload=await businessReportsApi.rtoProfit(filters); break;
        case 'hsrp': payload=await businessReportsApi.hsrp(filters); break;
        case 'vehicle': payload=await businessReportsApi.vehicles(filters); break;
        case 'agent-work': payload=await businessReportsApi.agentWork(filters); break;
        case 'balance-sheet': {
          const x=await accountingApi.balanceSheet(); payload={rows:[{particular:'Assets',amount:x.assets},{particular:'Liabilities',amount:x.liabilities},{particular:'Difference',amount:x.difference}],summary:{assets:x.assets,liabilities:x.liabilities,difference:x.difference}}; break;
        }
        case 'profit-loss': {
          const x=await accountingApi.profitLoss(); payload={rows:[{particular:'Income',amount:x.income},{particular:'Expense',amount:x.expense},{particular:'Net Profit',amount:x.net_profit}],summary:{income:x.income,expense:x.expense,net_profit:x.net_profit}}; break;
        }
        case 'trial-balance': {
          const x=await accountingApi.trialBalance(); payload={rows:x.rows as unknown as Array<Record<string,unknown>>,summary:{total_debit:x.total_debit,total_credit:x.total_credit,difference:Number(x.total_debit)-Number(x.total_credit)}}; break;
        }
        case 'day-book': {
          const x=await accountingApi.vouchers(); payload={rows:x.map(v=>({date:String(v.voucher_date).slice(0,10),voucher_number:v.voucher_number,type:v.voucher_type,narration:v.narration,amount:Number(v.total_debit)})),summary:{entries:x.length,total:x.reduce((n,v)=>n+Number(v.total_debit||0),0)}}; break;
        }
        default: payload={rows:[],summary:{}};
      }
      setData(payload);
    }catch(e){setError(e instanceof Error?e.message:'Report load nahi hua.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[report]);
  const columns=useMemo(()=>{const first=data.rows[0]; return first?Object.keys(first).filter(k=>!hideKeys.has(k)):[]},[data.rows]);
  const exportRows=useMemo(()=>data.rows.map(row=>Object.fromEntries(columns.map(key=>[label(key),display(key,row[key])]))),[data.rows,columns]);
  async function doExport(kind:'pdf'|'excel'){
    try{setExporting(kind);setError('');const title=titles[report]||'ERP Report';if(kind==='pdf')await exportRowsToPdf(title,report,exportRows,data.summary);else await exportRowsToExcel(report,exportRows);}catch(e){setError(e instanceof Error?e.message:'Export failed.');}finally{setExporting('');}
  }
  const summary=Object.entries(data.summary||{});
  return <main className="min-h-screen bg-[#f4f7fb] p-4 md:p-6 text-slate-950 print:bg-white print:p-0">
    <div className="mx-auto max-w-[1600px] space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#07122f] via-[#0e2d70] to-[#2367e8] p-6 text-white shadow-2xl md:p-8 print:rounded-none print:bg-white print:p-0 print:text-black print:shadow-none">
        <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[.25em] text-cyan-200 print:text-slate-500">Report Master</p><h1 className="mt-2 text-3xl font-black md:text-4xl">{titles[report]||'Report'}</h1><p className="mt-2 text-sm text-blue-100 print:text-slate-600">Live ERP data · tenant wise · export ready.</p></div><div className="flex flex-wrap gap-2 print:hidden"><Link href="/reports" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold">All Reports</Link><button onClick={()=>window.print()} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-800">Print</button><button disabled={!!exporting} onClick={()=>void doExport('pdf')} className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-black text-rose-800 disabled:opacity-50">{exporting==='pdf'?'Creating PDF...':'PDF'}</button><button disabled={!!exporting} onClick={()=>void doExport('excel')} className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 disabled:opacity-50">{exporting==='excel'?'Creating Excel...':'Excel'}</button></div></div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{summary.map(([k,v])=><article key={k} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label(k)}</p><p className="mt-2 text-xl font-black">{moneyKeys.test(k)?money(v):Number(v).toLocaleString('en-IN')}</p></article>)}</section>
      <section className="rounded-[28px] border bg-white p-4 shadow-sm md:p-5 print:hidden"><div className="grid gap-3 md:grid-cols-4"><label className="text-xs font-black uppercase text-slate-500">From<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm"/></label><label className="text-xs font-black uppercase text-slate-500">To<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm"/></label><label className="text-xs font-black uppercase text-slate-500">Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Vehicle / policy / customer..." className="mt-2 w-full rounded-xl border px-3 py-3 text-sm"/></label><div className="flex items-end"><button onClick={()=>void load()} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-black text-white">Apply Filter</button></div></div></section>
      {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{error}</div>}
      <section className="overflow-hidden rounded-[28px] border bg-white shadow-sm print:rounded-none print:shadow-none"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-xl font-black">Detailed Report</h2><p className="text-sm text-slate-500">{loading?'Loading...':`${data.rows.length} records`}</p></div></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr>{columns.map(c=><th key={c} className="whitespace-nowrap px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">{label(c)}</th>)}</tr></thead><tbody>{!loading&&data.rows.map((r,i)=><tr key={i} className="border-t hover:bg-blue-50/40">{columns.map(c=><td key={c} className="whitespace-nowrap px-4 py-3 font-medium">{display(c,r[c])}</td>)}</tr>)}{!loading&&!data.rows.length&&<tr><td colSpan={Math.max(columns.length,1)} className="p-12 text-center text-slate-400">No records found.</td></tr>}</tbody></table></div></section>
    </div>
  </main>;
}
