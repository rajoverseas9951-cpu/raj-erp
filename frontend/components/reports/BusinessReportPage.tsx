'use client';

import {useEffect,useMemo,useState} from 'react';
import {exportRowsCsv,printReport,tableHtml} from '@/lib/report-export';
import type {ReportPayload} from '@/lib/business-reports';

type Props={title:string;subtitle:string;loader:(filters?:Record<string,string|undefined>)=>Promise<ReportPayload>;summaryLabels?:Record<string,string>;filename:string};
const money=(n:unknown)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n||0));
const label=(s:string)=>s.replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
const format=(key:string,v:unknown)=>/(amount|billing|cost|profit|premium|commission|received|due|income|expense|payment)/i.test(key)?money(v):String(v??'—');

export default function BusinessReportPage({title,subtitle,loader,summaryLabels={},filename}:Props){
 const [data,setData]=useState<ReportPayload>({rows:[],summary:{}}); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
 const [from,setFrom]=useState(''); const [to,setTo]=useState(''); const [search,setSearch]=useState('');
 const load=()=>{setLoading(true);setError('');loader({from:from||undefined,to:to||undefined,search:search||undefined}).then(setData).catch(e=>setError(e instanceof Error?e.message:'Report load nahi hua')).finally(()=>setLoading(false))};
 useEffect(()=>{load()},[]);
 const cols=useMemo(()=>Array.from(new Set(data.rows.flatMap(r=>Object.keys(r)))).filter(c=>!['id','tenant_id','deleted_at','created_at','updated_at'].includes(c)),[data.rows]);
 const summary=Object.entries(data.summary||{});
 const doPrint=()=>printReport(title,`<h1>${title}</h1><div class="meta">${subtitle}${from||to?` | Period: ${from||'Start'} to ${to||'Today'}`:''}</div><div class="summary">${summary.map(([k,v])=>`<div class="card"><div class="label">${summaryLabels[k]||label(k)}</div><div class="value">${format(k,v)}</div></div>`).join('')}</div>${tableHtml(data.rows,cols)}`);
 return <main className="min-h-screen bg-[#f3f7fc] p-4 md:p-6"><div className="mx-auto max-w-[1650px] space-y-5">
  <section className="rounded-[30px] bg-gradient-to-br from-[#07162f] via-[#103579] to-[#2872ef] p-6 text-white shadow-xl"><p className="text-xs font-black uppercase tracking-[.22em] text-cyan-200">Report</p><h1 className="mt-2 text-3xl font-black">{title}</h1><p className="mt-2 max-w-3xl text-sm text-blue-100">{subtitle}</p></section>
  <section className="grid gap-3 rounded-[24px] border bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_2fr_auto_auto_auto]"><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="rounded-xl border px-3 py-3"/><input type="date" value={to} onChange={e=>setTo(e.target.value)} className="rounded-xl border px-3 py-3"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="rounded-xl border px-3 py-3"/><button onClick={load} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">Apply</button><button onClick={()=>exportRowsCsv(filename,data.rows)} className="rounded-xl border px-5 py-3 font-bold">Excel</button><button onClick={doPrint} className="rounded-xl border px-5 py-3 font-bold">PDF / Print</button></section>
  {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div>}
  <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{summary.map(([k,v])=><article key={k} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{summaryLabels[k]||label(k)}</p><p className="mt-2 text-xl font-black text-[#0d2d61]">{format(k,v)}</p></article>)}</section>
  <section className="overflow-hidden rounded-[24px] border bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[#eaf2ff] text-[#15396e]"><tr>{cols.map(c=><th key={c} className="whitespace-nowrap px-4 py-3 text-left text-xs font-black uppercase">{label(c)}</th>)}</tr></thead><tbody>{loading?<tr><td className="p-8 text-center" colSpan={Math.max(1,cols.length)}>Loading...</td></tr>:data.rows.length?data.rows.map((r,i)=><tr key={String(r.id??i)} className="border-t">{cols.map(c=><td key={c} className="whitespace-nowrap px-4 py-3">{format(c,r[c])}</td>)}</tr>):<tr><td className="p-8 text-center text-slate-500" colSpan={Math.max(1,cols.length)}>No records found.</td></tr>}</tbody></table></div></section>
 </div></main>
}
