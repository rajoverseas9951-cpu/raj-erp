'use client';

import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import BusinessReportPage from '@/components/reports/BusinessReportPage';
import {businessReportsApi} from '@/lib/business-reports';
import {accountingApi} from '@/lib/accounting';
import {authenticatedRequest} from '@/lib/api-client';
import {exportRowsCsv,printReport,tableHtml} from '@/lib/report-export';

const configs:Record<string,{title:string;subtitle:string;loader:any;filename:string}>={
 'expiry':{title:'Expiry Report',subtitle:'Insurance, PUC, fitness, permit and tax renewal follow-up.',loader:businessReportsApi.expiry,filename:'expiry-report'},
 'agent':{title:'Agent Report',subtitle:'Agent-wise insurance and service work summary.',loader:businessReportsApi.agents,filename:'agent-report'},
 'broker':{title:'Broker Report',subtitle:'Broker-wise RTO work, billing, cost and profit.',loader:businessReportsApi.brokers,filename:'broker-report'},
 'insurance':{title:'Insurance Report',subtitle:'Policy-wise premium, customer payment and insurance earning.',loader:businessReportsApi.insurance,filename:'insurance-report'},
 'insurance-commission':{title:'Insurance Commission Report',subtitle:'Company/source-wise gross commission, agent commission and net earning.',loader:businessReportsApi.insuranceCommission,filename:'insurance-commission'},
 'insurance-due':{title:'Insurance Due Report',subtitle:'Pending insurance customer payment and follow-up.',loader:businessReportsApi.insuranceDue,filename:'insurance-due'},
 'rto-work':{title:'RTO Work Report',subtitle:'RTO, PUC, fitness, permit, tax, HSRP, SLD, transfer, driving licence and passport work.',loader:businessReportsApi.rtoWork,filename:'rto-work'},
 'rto-profit':{title:'RTO Profit Report',subtitle:'Category-wise billing, direct cost and net margin including licence and passport services.',loader:businessReportsApi.rtoProfit,filename:'rto-profit'},
 'hsrp':{title:'HSRP Report',subtitle:'HSRP orders, delivery, billing and dealer cost.',loader:businessReportsApi.hsrp,filename:'hsrp-report'},
 'vehicle':{title:'Vehicle Report',subtitle:'Vehicle/customer master with compliance status.',loader:businessReportsApi.vehicles,filename:'vehicle-report'},
 'agent-work':{title:'Agent Work Report',subtitle:'Detailed RTO/service work assigned to agents.',loader:businessReportsApi.agentWork,filename:'agent-work'},
};

const money=(n:unknown)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n||0));
export default function ReportSlugPage(){const {slug}=useParams<{slug:string}>(); if(configs[slug]){const c=configs[slug];return <BusinessReportPage {...c}/>;} return <Financial slug={slug}/>}

function Financial({slug}:{slug:string}){const [data,setData]=useState<any>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
 const title=slug==='balance-sheet'?'Balance Sheet':slug==='profit-loss'?'Profit & Loss':slug==='trial-balance'?'Trial Balance':slug==='day-book'?'Day Book':'Financial Report';
 useEffect(()=>{setLoading(true);const p=slug==='balance-sheet'?accountingApi.balanceSheet():slug==='profit-loss'?accountingApi.profitLoss():slug==='trial-balance'?accountingApi.trialBalance():slug==='day-book'?authenticatedRequest<any[]>('/accounting/day-book'):Promise.reject(new Error('Report not found'));p.then(setData).catch(e=>setError(e instanceof Error?e.message:'Report load failed')).finally(()=>setLoading(false))},[slug]);
 const rows:Array<Record<string,unknown>>=slug==='trial-balance'?(data?.rows||[]):slug==='day-book'?(Array.isArray(data)?data:[]):data?Object.entries(data).map(([particular,amount])=>({particular,amount})):[];
 const pdf=()=>printReport(title,`<h1>${title}</h1><div class="meta">Generated ${new Date().toLocaleString('en-IN')}</div>${slug==='balance-sheet'&&data?`<div class="summary"><div class="card"><div class="label">Assets</div><div class="value">${money(data.assets)}</div></div><div class="card"><div class="label">Liabilities + Profit</div><div class="value">${money(data.liabilities)}</div></div><div class="card"><div class="label">Difference</div><div class="value">${money(data.difference)}</div></div></div>`:''}${tableHtml(rows)}`);
 return <main className="min-h-screen bg-[#f3f7fc] p-4 md:p-6"><div className="mx-auto max-w-[1450px] space-y-5"><section className="rounded-[30px] bg-gradient-to-br from-[#07162f] via-[#103579] to-[#2872ef] p-7 text-white"><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">Yearly Accounts</p><h1 className="mt-2 text-4xl font-black">{title}</h1><p className="mt-2 text-blue-100">Simple year-end financial view; accounting engine remains in the background.</p></section><div className="flex flex-wrap gap-3"><button onClick={()=>exportRowsCsv(slug,rows)} className="rounded-xl border bg-white px-5 py-3 font-bold">Excel</button><button onClick={pdf} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">PDF / Print</button></div>{error&&<div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}<section className="rounded-[24px] border bg-white p-5 shadow-sm">{loading?<p>Loading...</p>:slug==='balance-sheet'&&data?<div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-blue-50 p-6"><p className="text-xs font-black uppercase text-blue-500">Assets</p><p className="mt-2 text-3xl font-black">{money(data.assets)}</p></div><div className="rounded-2xl bg-slate-900 p-6 text-white"><p className="text-xs font-black uppercase text-slate-300">Liabilities + Current Profit</p><p className="mt-2 text-3xl font-black">{money(data.liabilities)}</p></div><div className="rounded-2xl border p-5">Book Liabilities <b className="float-right">{money(data.book_liabilities)}</b></div><div className="rounded-2xl border p-5">Current Year Profit <b className="float-right">{money(data.current_year_profit)}</b></div><div className={`rounded-2xl p-5 md:col-span-2 ${Math.abs(Number(data.difference||0))<0.01?'bg-emerald-50 text-emerald-800':'bg-amber-50 text-amber-900'}`}>Balance Difference <b className="float-right">{money(data.difference)}</b></div></div>:<div className="overflow-x-auto" dangerouslySetInnerHTML={{__html:tableHtml(rows)}}/>}</section></div></main>}
