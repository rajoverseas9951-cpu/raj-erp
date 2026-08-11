'use client';

import { useEffect, useMemo, useState } from 'react';
import { businessReportsApi, BusinessOverview, InsuranceReportRow, RtoReportRow, CategoryRow } from '@/lib/business-reports';

const money = (n:number|string|undefined) => `₹${Number(n || 0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export default function ReportsPage(){
  const [from,setFrom]=useState(''); const [to,setTo]=useState(''); const [search,setSearch]=useState('');
  const [overview,setOverview]=useState<BusinessOverview|null>(null);
  const [insurance,setInsurance]=useState<{rows:InsuranceReportRow[];summary:Record<string,number>}|null>(null);
  const [commission,setCommission]=useState<{rows:Array<Record<string,string|number>>;summary:Record<string,number>}|null>(null);
  const [rto,setRto]=useState<{rows:RtoReportRow[];categories:CategoryRow[];summary:Record<string,number>}|null>(null);
  const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const filters=useMemo(()=>({from:from||undefined,to:to||undefined,search:search||undefined}),[from,to,search]);

  async function load(){setLoading(true);setError('');try{
    const [o,i,c,r]=await Promise.all([businessReportsApi.overview(filters),businessReportsApi.insurance(filters),businessReportsApi.insuranceCommission(filters),businessReportsApi.rtoWork(filters)]);
    setOverview(o);setInsurance(i);setCommission(c);setRto(r);
  }catch(e){setError(e instanceof Error?e.message:'Reports load nahi hue.')}finally{setLoading(false)}}
  useEffect(()=>{void load()},[]);

  function exportCsv(rows:Array<Record<string,unknown>>, name:string){
    if(!rows.length)return; const keys=Object.keys(rows[0]); const esc=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`;
    const csv=[keys.join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
  }

  return <main className="min-h-screen bg-[#eef4fb] p-4 sm:p-6 lg:p-8 print:bg-white">
    <div className="mx-auto max-w-[1600px] space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(125deg,#06152f,#0b2f6b_55%,#1769e0)] p-6 text-white shadow-[0_30px_80px_rgba(7,26,60,.22)] sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-[10px] font-black uppercase tracking-[.24em] text-cyan-300">Business Intelligence</p><h1 className="mt-2 text-4xl font-black">Accounts & Reports</h1><p className="mt-2 text-sm text-blue-100/80">Insurance is separate. RTO, Tax, Permit, PUC, Fitness, HSRP, SLD and transfer work are grouped under RTO business.</p></div><div className="flex gap-2 print:hidden"><a href="/accounts" className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black">Accounts</a><button onClick={()=>window.print()} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#0b2f6b]">Print Report</button></div></div>
      </section>

      <section className="grid gap-3 rounded-[24px] border border-[#dce7f4] bg-white p-4 shadow-sm md:grid-cols-5 print:hidden">
        <label className="text-xs font-black text-slate-600">From<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="field"/></label>
        <label className="text-xs font-black text-slate-600">To<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="field"/></label>
        <label className="text-xs font-black text-slate-600 md:col-span-2">Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Policy, vehicle, customer, work type..." className="field"/></label>
        <button onClick={()=>void load()} className="self-end rounded-2xl bg-gradient-to-r from-[#0b2f6b] to-[#2563eb] px-5 py-3.5 text-sm font-black text-white">Refresh Reports</button>
      </section>

      {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div>}
      {loading?<div className="rounded-2xl bg-white p-8 font-bold">Loading reports...</div>:<>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Policies" value={String(overview?.policy_count||0)} sub={money(overview?.insurance_premium)}/>
          <Stat label="Insurance Profit" value={money(overview?.insurance_profit)} sub={`Commission ${money(overview?.insurance_commission)}`}/>
          <Stat label="RTO Work" value={String(overview?.rto_work_count||0)} sub={`Billing ${money(overview?.rto_billing)}`}/>
          <Stat label="RTO Profit" value={money(overview?.rto_profit)} sub={`Cost ${money(overview?.rto_cost)}`}/>
          <Stat label="Total Business Profit" value={money(overview?.total_business_profit)} sub={`RTO received ${money(overview?.rto_payment_received)}`}/>
        </section>

        <ReportSection title="Insurance Policy Report" subtitle="Policy-wise premium, customer payment, commission and net earning." actions={<button onClick={()=>exportCsv((insurance?.rows||[]) as unknown as Array<Record<string,unknown>>,'insurance-policy-report.csv')} className="linkBtn">Excel / CSV</button>}>
          <Table headers={['Date','Policy','Vehicle','Customer','Company','Type','Premium','Customer Pay','Gross Comm.','Agent Comm.','Discount','Net Comm.']} rows={(insurance?.rows||[]).map(r=>[r.date,r.policy_number,r.vehicle_number,r.customer_name,r.company_name,r.insurance_type,money(r.gross_premium),money(r.customer_pay),money(r.gross_commission),money(r.agent_commission),money(r.customer_discount),money(r.net_commission)])}/>
          <Summary items={[['Policies',insurance?.summary.count],['Premium',money(insurance?.summary.gross_premium)],['Gross Commission',money(insurance?.summary.gross_commission)],['Net Commission',money(insurance?.summary.net_commission)]]}/>
        </ReportSection>

        <ReportSection title="Insurance Commission Report" subtitle="Company and purchase-source wise commission performance." actions={<button onClick={()=>exportCsv((commission?.rows||[]) as Array<Record<string,unknown>>,'insurance-commission-report.csv')} className="linkBtn">Excel / CSV</button>}>
          <Table headers={['Company','Purchase From','Policies','Premium','Gross Commission','Agent Commission','Discount','Net Commission']} rows={(commission?.rows||[]).map(r=>[r.company_name,r.purchase_from,r.policy_count,money(r.gross_premium),money(r.gross_commission),money(r.agent_commission),money(r.discount),money(r.net_commission)])}/>
        </ReportSection>

        <ReportSection title="RTO Category Profit Report" subtitle="All non-insurance vehicle work grouped under RTO business." actions={<button onClick={()=>exportCsv((rto?.categories||[]) as unknown as Array<Record<string,unknown>>,'rto-category-profit.csv')} className="linkBtn">Excel / CSV</button>}>
          <Table headers={['Category','Works','Billing','Cost','Profit']} rows={(rto?.categories||[]).map(r=>[r.module,r.work_count,money(r.billing),money(r.cost),money(r.profit)])}/>
          <Summary items={[['Total Work',rto?.summary.work_count],['Billing',money(rto?.summary.billing)],['Cost',money(rto?.summary.cost)],['Profit',money(rto?.summary.profit)],['Payment Received',money(rto?.summary.payment_received)]]}/>
        </ReportSection>

        <ReportSection title="Detailed RTO Work Report" subtitle="Vehicle and customer-wise work register with billing, cost and profit." actions={<button onClick={()=>exportCsv((rto?.rows||[]) as unknown as Array<Record<string,unknown>>,'rto-work-report.csv')} className="linkBtn">Excel / CSV</button>}>
          <Table headers={['Date','Category','Work Type','Vehicle','Customer','Reference','Billing','Cost','Profit','Status']} rows={(rto?.rows||[]).map(r=>[r.date,r.module,r.work_type,r.vehicle_number,r.customer_name,r.reference_number||'—',money(r.billed),money(r.cost),money(r.profit),r.status||'—'])}/>
        </ReportSection>
      </>}
    </div>
    <style jsx>{`.field{margin-top:.5rem;width:100%;border:1px solid #d9e4f1;border-radius:16px;background:#f8fbff;padding:.85rem 1rem;font-weight:700;outline:none}.field:focus{border-color:#60a5fa;box-shadow:0 0 0 4px rgba(96,165,250,.14)}.linkBtn{border:1px solid #d9e4f1;border-radius:14px;background:#fff;padding:.65rem 1rem;font-size:.78rem;font-weight:900;color:#174b98}@media print{button,a{display:none!important}}`}</style>
  </main>
}

function Stat({label,value,sub}:{label:string;value:string;sub:string}){return <div className="rounded-[24px] border border-[#dce7f4] bg-white p-5 shadow-[0_12px_35px_rgba(20,53,102,.07)]"><p className="text-[10px] font-black uppercase tracking-[.15em] text-blue-500">{label}</p><p className="mt-2 text-2xl font-black text-[#0a2147]">{value}</p><p className="mt-1 text-xs font-semibold text-slate-400">{sub}</p></div>}
function ReportSection({title,subtitle,actions,children}:{title:string;subtitle:string;actions?:React.ReactNode;children:React.ReactNode}){return <section className="overflow-hidden rounded-[26px] border border-[#dce7f4] bg-white shadow-[0_16px_44px_rgba(25,55,95,.07)]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7eef7] bg-gradient-to-r from-[#fbfdff] to-[#eef5ff] px-5 py-5 sm:px-7"><div><h2 className="text-xl font-black text-[#10213f]">{title}</h2><p className="mt-1 text-xs font-semibold text-slate-400">{subtitle}</p></div><div className="print:hidden">{actions}</div></div>{children}</section>}
function Table({headers,rows}:{headers:string[];rows:Array<Array<React.ReactNode>>}){return <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-[#f8fbff] text-[10px] uppercase tracking-wide text-slate-500"><tr>{headers.map(h=><th key={h} className="px-4 py-3 font-black">{h}</th>)}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={i} className="border-t border-slate-100 hover:bg-blue-50/30">{r.map((v,j)=><td key={j} className={`px-4 py-3 ${j===0||j===1||j===2?'font-bold text-[#173b76]':'text-slate-600'}`}>{v}</td>)}</tr>):<tr><td colSpan={headers.length} className="p-8 text-center font-semibold text-slate-400">No data</td></tr>}</tbody></table></div>}
function Summary({items}:{items:Array<[string,React.ReactNode]>}){return <div className="grid gap-3 border-t border-slate-100 bg-[#fbfdff] p-4 sm:grid-cols-2 lg:grid-cols-5">{items.map(([k,v])=><div key={k}><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{k}</p><p className="mt-1 font-black text-[#0a2147]">{v}</p></div>)}</div>}
