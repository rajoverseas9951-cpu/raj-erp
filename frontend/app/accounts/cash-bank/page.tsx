'use client';

import { FormEvent,useEffect,useMemo,useState } from 'react';
import { ledgerApi,Ledger } from '@/lib/ledgers';
import { financeControlApi } from '@/lib/finance-control';

const money=(n:number|string|undefined)=>`₹${Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;

export default function CashBankPage(){
 const[ledgers,setLedgers]=useState<Ledger[]>([]);const[saving,setSaving]=useState(false);const[msg,setMsg]=useState('');const[error,setError]=useState('');const[type,setType]=useState<'received'|'paid'|'expense'>('received');
 useEffect(()=>{ledgerApi.list().then(setLedgers).catch(e=>setError(e instanceof Error?e.message:'Accounts could not load.'))},[]);
 const cashBank=useMemo(()=>ledgers.filter(l=>['Cash-in-Hand','Bank Accounts'].includes(l.ledger_group)),[ledgers]);
 const others=useMemo(()=>ledgers.filter(l=>!['Cash-in-Hand','Bank Accounts'].includes(l.ledger_group)),[ledgers]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const form=e.currentTarget;
  const f=new FormData(form);
  setSaving(true);setError('');setMsg('');
  try{
   const r=await financeControlApi.simpleEntry({entry_type:type,date:String(f.get('date')),amount:Number(f.get('amount')),cash_bank_ledger_id:String(f.get('cash_bank_ledger_id')),other_ledger_id:String(f.get('other_ledger_id')),reference_number:String(f.get('reference_number')||''),notes:String(f.get('notes')||'')});
   setMsg(`Saved successfully · ${r.voucher_number}`);
   form.reset();
  }catch(err){setError(err instanceof Error?err.message:'Entry could not be saved.')}finally{setSaving(false)}
 }
 return <main className="min-h-screen bg-[#f3f7fc] p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1200px] space-y-5">
  <section className="rounded-[30px] bg-gradient-to-br from-[#07172f] via-[#0d3474] to-[#2167df] p-7 text-white shadow-xl"><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200">Daily Accounts</p><h1 className="mt-2 text-4xl font-black">Cash & Bank Entry</h1><p className="mt-2 max-w-2xl text-sm text-blue-100/80">No debit-credit jargon. Just tell the system whether money came in, went out, or was an expense.</p></section>
  {(msg||error)&&<div className={`rounded-2xl border p-4 font-bold ${error?'border-red-200 bg-red-50 text-red-700':'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error||msg}</div>}
  <section className="rounded-[26px] border border-[#dbe6f3] bg-white p-5 shadow-sm sm:p-7">
   <div className="grid gap-3 sm:grid-cols-3">{([['received','Money Received','Customer/party se paisa aaya'],['paid','Money Paid','Party/agent ko payment diya'],['expense','Expense','Office ya business expense']] as const).map(([v,t,s])=><button key={v} type="button" onClick={()=>setType(v)} className={`rounded-2xl border p-4 text-left transition ${type===v?'border-blue-500 bg-blue-50 ring-4 ring-blue-100':'border-slate-200 hover:border-blue-300'}`}><strong className="block text-base text-[#0b2d61]">{t}</strong><span className="mt-1 block text-xs text-slate-500">{s}</span></button>)}</div>
   <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
    <Field label="Date"><input name="date" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className="input"/></Field>
    <Field label="Amount"><input name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" className="input"/></Field>
    <Field label="Cash / Bank"><select name="cash_bank_ledger_id" required className="input"><option value="">Select account</option>{cashBank.map(l=><option key={l.id} value={l.id}>{l.ledger_name}</option>)}</select></Field>
    <Field label={type==='received'?'Received From':type==='expense'?'Expense Head':'Paid To'}><select name="other_ledger_id" required className="input"><option value="">Select party / account</option>{others.map(l=><option key={l.id} value={l.id}>{l.ledger_name} · {l.ledger_group}</option>)}</select></Field>
    <Field label="Reference"><input name="reference_number" placeholder="Optional receipt/reference" className="input"/></Field>
    <Field label="Notes"><input name="notes" placeholder="Short note" className="input"/></Field>
    <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f8fbff] p-4"><p className="text-xs font-semibold text-slate-500">Entry will automatically keep both sides of accounts balanced.</p><button disabled={saving} className="rounded-2xl bg-gradient-to-r from-[#0b2f6b] to-[#2563eb] px-6 py-3 font-black text-white disabled:opacity-50">{saving?'Saving…':'Save Entry'}</button></div>
   </form>
  </section>
  <section className="grid gap-3 sm:grid-cols-3"><Quick href="/accounts/outstanding" title="Party Balance" copy="See who has to pay and whom you have to pay."/><Quick href="/reports/profit-loss" title="Yearly Profit" copy="Check income, expense and net profit."/><Quick href="/reports/balance-sheet" title="Balance Sheet" copy="Check year-end financial position."/></section>
  <style jsx>{`.input{margin-top:.5rem;width:100%;border:1px solid #d9e4f1;border-radius:16px;background:#f8fbff;padding:.9rem 1rem;font-weight:700;outline:none}.input:focus{border-color:#60a5fa;box-shadow:0 0 0 4px rgba(96,165,250,.14)}`}</style>
 </div></main>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="text-sm font-black text-slate-600">{label}{children}</label>}
function Quick({href,title,copy}:{href:string;title:string;copy:string}){return <a href={href} className="rounded-2xl border border-[#dbe6f3] bg-white p-4 shadow-sm"><strong className="text-[#0b2d61]">{title} →</strong><p className="mt-1 text-xs text-slate-500">{copy}</p></a>}
