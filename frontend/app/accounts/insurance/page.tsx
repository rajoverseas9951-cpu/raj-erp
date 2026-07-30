'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CommissionRow, CommissionSummary, InsuranceCompany, insuranceAccountingApi } from '@/lib/insurance-accounting';

const money = (value:number) => `₹${Number(value || 0).toFixed(2)}`;

export default function InsuranceAccountingPage() {
  const [companies,setCompanies]=useState<InsuranceCompany[]>([]);
  const [rows,setRows]=useState<CommissionRow[]>([]);
  const [summary,setSummary]=useState<CommissionSummary>({gross_commission:0,tds_receivable:0,net_receivable:0,received:0,outstanding:0});
  const [error,setError]=useState(''); const [success,setSuccess]=useState(''); const [saving,setSaving]=useState(false);

  async function load(){
    try { const [c,r,s]=await Promise.all([insuranceAccountingApi.companies(),insuranceAccountingApi.commissions(),insuranceAccountingApi.summary()]); setCompanies(c);setRows(r);setSummary(s); }
    catch(e){ const m=e instanceof Error?e.message:'Data load nahi hua.'; if(/unauthenticated|401/i.test(m)){sessionStorage.removeItem('raj_erp_token');location.href='/login';} else setError(m); }
  }
  useEffect(()=>{void load();},[]);

  async function addCompany(e:FormEvent<HTMLFormElement>){e.preventDefault();const el=e.currentTarget;const f=new FormData(el);setSaving(true);setError('');setSuccess('');try{await insuranceAccountingApi.addCompany({company_name:f.get('company_name'),short_code:f.get('short_code'),default_commission_percent:Number(f.get('default_commission_percent')||0),tds_percent:Number(f.get('tds_percent')||0),settlement_days:Number(f.get('settlement_days')||30),gst_number:f.get('gst_number'),pan_number:f.get('pan_number'),contact_person:f.get('contact_person'),mobile:f.get('mobile'),email:f.get('email')});el.reset();setSuccess('Insurance company aur uska ledger create ho gaya.');await load();}catch(x){setError(x instanceof Error?x.message:'Company create nahi hui.');}finally{setSaving(false)}}

  async function addCommission(e:FormEvent<HTMLFormElement>){e.preventDefault();const el=e.currentTarget;const f=new FormData(el);setSaving(true);setError('');setSuccess('');try{await insuranceAccountingApi.addCommission({insurance_company_id:f.get('insurance_company_id'),statement_number:f.get('statement_number'),statement_date:f.get('statement_date'),policy_number:f.get('policy_number'),customer_name:f.get('customer_name'),gross_premium:Number(f.get('gross_premium')||0),commission_percent:Number(f.get('commission_percent')||0),gross_commission:Number(f.get('gross_commission')||0),tds_percent:Number(f.get('tds_percent')||0),remarks:f.get('remarks')});el.reset();setSuccess('Commission entry save ho gayi. TDS aur net receivable automatic calculate hua.');await load();}catch(x){setError(x instanceof Error?x.message:'Commission save nahi hui.');}finally{setSaving(false)}}

  return <main className="space-y-6 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Insurance Company Accounting</h1><p className="text-slate-500">Company, commission statement, TDS aur receipt management.</p></div><div className="flex gap-2"><a href="/accounts" className="rounded-xl border px-4 py-2">Accounts</a><a href="/dashboard" className="rounded-xl border px-4 py-2">Dashboard</a></div></div>
    {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}{success&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{success}</div>}
    <div className="grid gap-4 md:grid-cols-5">{[['Gross Commission',summary.gross_commission],['TDS Receivable',summary.tds_receivable],['Net Receivable',summary.net_receivable],['Received',summary.received],['Outstanding',summary.outstanding]].map(([l,v])=><div key={String(l)} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{l}</p><p className="mt-2 text-xl font-bold">{money(Number(v))}</p></div>)}</div>

    <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Add Insurance Company</h2><form onSubmit={addCompany} className="mt-4 grid gap-4 md:grid-cols-4">
      <Input name="company_name" label="Company Name" required/><Input name="short_code" label="Short Code"/><Input name="default_commission_percent" label="Default Commission %" type="number" step="0.001"/><Input name="tds_percent" label="TDS %" type="number" step="0.001" required/>
      <Input name="settlement_days" label="Settlement Days" type="number" defaultValue="30"/><Input name="gst_number" label="GST Number"/><Input name="pan_number" label="PAN Number"/><Input name="contact_person" label="Contact Person"/><Input name="mobile" label="Mobile"/><Input name="email" label="Email" type="email"/>
      <div className="md:col-span-2"><button disabled={saving} className="rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white disabled:opacity-60">Create Company</button></div></form></section>

    <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Commission Entry</h2><form onSubmit={addCommission} className="mt-4 grid gap-4 md:grid-cols-4">
      <label className="text-sm font-semibold">Insurance Company<select name="insurance_company_id" required className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="">Select Company</option>{companies.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</select></label>
      <Input name="statement_number" label="Statement Number"/><Input name="statement_date" label="Statement Date" type="date" required/><Input name="policy_number" label="Policy Number"/><Input name="customer_name" label="Customer Name"/><Input name="gross_premium" label="Gross Premium" type="number" step="0.01"/><Input name="commission_percent" label="Commission %" type="number" step="0.001" required/><Input name="gross_commission" label="Gross Commission (optional)" type="number" step="0.01"/><Input name="tds_percent" label="TDS %" type="number" step="0.001" required/><Input name="remarks" label="Remarks"/>
      <div className="md:col-span-2"><button disabled={saving} className="rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white disabled:opacity-60">Save Commission</button></div></form></section>

    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-lg font-bold">Commission Statement</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Date','Company','Policy','Gross Commission','TDS','Net','Received','Outstanding','Status'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t"><td className="p-3">{r.statement_date}</td><td className="p-3 font-semibold">{r.company_name}</td><td className="p-3">{r.policy_number||'-'}</td><td className="p-3">{money(r.gross_commission)}</td><td className="p-3">{money(r.tds_amount)}</td><td className="p-3">{money(r.net_receivable)}</td><td className="p-3">{money(r.received_amount)}</td><td className="p-3 font-semibold">{money(r.net_receivable-r.received_amount)}</td><td className="p-3 uppercase">{r.status}</td></tr>)}</tbody></table></div></section>
  </main>;
}

function Input({name,label,type='text',required=false,step,defaultValue}:{name:string;label:string;type?:string;required?:boolean;step?:string;defaultValue?:string}){return <label className="text-sm font-semibold">{label}{required&&<span className="text-red-500"> *</span>}<input name={name} type={type} required={required} step={step} defaultValue={defaultValue} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"/></label>}
