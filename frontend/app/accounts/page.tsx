'use client';

import { FormEvent, useEffect, useState } from 'react';
import { accountingApi, TrialBalance, Voucher } from '@/lib/accounting';
import { Ledger, ledgerApi } from '@/lib/ledgers';

export default function AccountsPage() {
  const [ledgers,setLedgers]=useState<Ledger[]>([]);
  const [vouchers,setVouchers]=useState<Voucher[]>([]);
  const [trial,setTrial]=useState<TrialBalance|null>(null);
  const [pl,setPl]=useState<{income:number;expense:number;net_profit:number}|null>(null);
  const [bs,setBs]=useState<{assets:number;liabilities:number;difference:number}|null>(null);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [saving,setSaving]=useState(false);

  async function load(){
    try{
      const [l,v,t,p,b]=await Promise.all([ledgerApi.list(),accountingApi.vouchers(),accountingApi.trialBalance(),accountingApi.profitLoss(),accountingApi.balanceSheet()]);
      setLedgers(l);setVouchers(v);setTrial(t);setPl(p);setBs(b);
    }catch(e){setError(e instanceof Error?e.message:'Accounts load nahi hua.');}
  }
  useEffect(()=>{void load();},[]);

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setSaving(true);setError('');setSuccess('');
    const f=new FormData(e.currentTarget); const form=e.currentTarget;
    const amount=Number(f.get('amount')||0);
    try{
      await accountingApi.createVoucher({
        voucher_type:String(f.get('voucher_type')),
        voucher_date:String(f.get('voucher_date')),
        reference_number:String(f.get('reference_number')||''),
        narration:String(f.get('narration')||''),
        entries:[
          {ledger_id:String(f.get('debit_ledger')),entry_type:'debit',amount},
          {ledger_id:String(f.get('credit_ledger')),entry_type:'credit',amount},
        ],
      });
      form.reset();setSuccess('Voucher successfully post ho gaya.');await load();
    }catch(e){setError(e instanceof Error?e.message:'Voucher save nahi hua.');}
    finally{setSaving(false);}
  }

  return <main className="space-y-6 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">Accounts</h1><p className="text-slate-500">Double-entry accounting, vouchers aur financial reports.</p></div><div className="flex flex-wrap gap-2"><a href="/accounts/insurance" className="rounded-xl bg-blue-700 px-4 py-2 text-white">Insurance Accounting</a><a href="/accounts/ledgers" className="rounded-xl border px-4 py-2">Ledger Master</a><a href="/dashboard" className="rounded-xl border px-4 py-2">Dashboard</a></div></div>
    {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}{success&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{success}</div>}

    <div className="grid gap-4 md:grid-cols-3">
      <Card title="Net Profit" value={`₹${Number(pl?.net_profit||0).toFixed(2)}`} />
      <Card title="Total Assets" value={`₹${Number(bs?.assets||0).toFixed(2)}`} />
      <Card title="Total Liabilities" value={`₹${Number(bs?.liabilities||0).toFixed(2)}`} />
    </div>

    <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Create Voucher</h2><form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-3">
      <Field label="Voucher Type"><select name="voucher_type" className="input"><option value="receipt">Receipt</option><option value="payment">Payment</option><option value="contra">Contra</option><option value="journal">Journal</option><option value="sales">Sales</option><option value="purchase">Purchase</option></select></Field>
      <Field label="Date"><input name="voucher_date" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className="input"/></Field>
      <Field label="Amount"><input name="amount" type="number" min="0.01" step="0.01" required className="input"/></Field>
      <Field label="Debit Ledger"><select name="debit_ledger" required className="input"><option value="">Select</option>{ledgers.map(l=><option key={l.id} value={l.id}>{l.ledger_name}</option>)}</select></Field>
      <Field label="Credit Ledger"><select name="credit_ledger" required className="input"><option value="">Select</option>{ledgers.map(l=><option key={l.id} value={l.id}>{l.ledger_name}</option>)}</select></Field>
      <Field label="Reference"><input name="reference_number" className="input"/></Field>
      <label className="md:col-span-3 text-sm font-semibold">Narration<textarea name="narration" rows={3} className="input"/></label>
      <div className="md:col-span-3"><button disabled={saving} className="rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white disabled:opacity-60">{saving?'Posting...':'Post Voucher'}</button></div>
    </form></section>

    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-bold">Trial Balance</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Ledger</th><th className="p-3">Group</th><th className="p-3">Debit</th><th className="p-3">Credit</th></tr></thead><tbody>{trial?.rows.map(r=><tr key={r.ledger_id} className="border-t"><td className="p-3 font-semibold">{r.ledger_name}</td><td className="p-3">{r.ledger_group}</td><td className="p-3">₹{Number(r.debit).toFixed(2)}</td><td className="p-3">₹{Number(r.credit).toFixed(2)}</td></tr>)}</tbody><tfoot className="border-t font-bold"><tr><td className="p-3" colSpan={2}>Total</td><td className="p-3">₹{Number(trial?.total_debit||0).toFixed(2)}</td><td className="p-3">₹{Number(trial?.total_credit||0).toFixed(2)}</td></tr></tfoot></table></div></section>

    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-bold">Day Book / Recent Vouchers</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Date</th><th className="p-3">Voucher No.</th><th className="p-3">Type</th><th className="p-3">Narration</th><th className="p-3">Amount</th></tr></thead><tbody>{vouchers.map(v=><tr key={v.id} className="border-t"><td className="p-3">{String(v.voucher_date).slice(0,10)}</td><td className="p-3 font-semibold">{v.voucher_number}</td><td className="p-3 uppercase">{v.voucher_type}</td><td className="p-3">{v.narration}</td><td className="p-3">₹{Number(v.total_debit).toFixed(2)}</td></tr>)}</tbody></table></div></section>
    <style jsx>{`.input{margin-top:.5rem;width:100%;border:1px solid #cbd5e1;border-radius:.75rem;padding:.75rem;background:white}`}</style>
  </main>;
}
function Card({title,value}:{title:string;value:string}){return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="text-sm font-semibold">{label}{children}</label>}
