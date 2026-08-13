'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  moduleLabels,
  OperationalProfile,
  OperationalRecord,
  VehicleModule,
  vehicleOperationsApi,
} from '@/lib/vehicle-operations';
import { authenticatedRequest } from '@/lib/api-client';

type FieldSpec = { name: string; label: string; type?: string; required?: boolean };
type MasterOption = { id: string; name: string };
type Ledger = { id: string; ledger_name: string; ledger_group: string; opening_balance?: number; balance_type?: string; status: string };
type PaymentMode = 'cash' | 'bank';

const common: FieldSpec[] = [
  { name: 'reference_number', label: 'Receipt / Reference' },
  { name: 'period', label: 'Period' },
  { name: 'receipt_date', label: 'Receipt Date', type: 'date' },
  { name: 'issue_date', label: 'Issue Date', type: 'date' },
  { name: 'expiry_date', label: 'Expiry Date', type: 'date' },
  { name: 'amount', label: 'Amount', type: 'number' },
  { name: 'party_amount', label: 'Party Amount', type: 'number' },
  { name: 'status', label: 'Status' },
  { name: 'notes', label: 'Notes' },
];

const fields: Partial<Record<VehicleModule, FieldSpec[]>> = {
  permit: [{ name: 'permit_type', label: 'Permit Type', required: true }, { name: 'state', label: 'State' }, ...common],
  counter_tax: [...common, { name: 'dealer_name', label: 'Dealer Name' }, { name: 'dealer_amount', label: 'Dealer Amount', type: 'number' }],
  hsrp: [{ name: 'party_name', label: 'Customer / Party' }, { name: 'order_date', label: 'Order Date', type: 'date' }, { name: 'received_date', label: 'Received Date', type: 'date' }, { name: 'delivery_date', label: 'Delivery Date', type: 'date' }, { name: 'vendor', label: 'Vendor' }, ...common],
  sld: [{ name: 'vendor', label: 'Vendor' }, { name: 'fitment_date', label: 'Fitment Date', type: 'date' }, ...common],
  vltd: [{ name: 'vendor', label: 'VLTD Vendor' }, { name: 'fitment_date', label: 'Fitment Date', type: 'date' }, ...common],
  transfer: [{ name: 'new_owner_name', label: 'Intended New Owner', required: true }, { name: 'application_date', label: 'Application Date', type: 'date' }, { name: 'completion_date', label: 'Completion Date', type: 'date' }, { name: 'reference_number', label: 'Application / Reference' }, { name: 'status', label: 'Status' }, { name: 'amount', label: 'Fees', type: 'number' }, { name: 'notes', label: 'Notes' }],
  agent_payment: [{ name: 'party_name', label: 'Agent / Vendor' }, { name: 'account', label: 'Method / Account' }, { name: 'issue_date', label: 'Date', type: 'date' }, { name: 'billed_amount', label: 'Amount Payable', type: 'number' }, { name: 'paid_amount', label: 'Amount Paid', type: 'number' }, { name: 'reference_number', label: 'Reference' }, { name: 'notes', label: 'Remarks' }],
  other_payment: [{ name: 'purpose', label: 'Purpose / Category', required: true }, { name: 'party_name', label: 'Party' }, { name: 'issue_date', label: 'Date', type: 'date' }, { name: 'party_amount', label: 'Party Amount', type: 'number' }, { name: 'amount', label: 'Cost Amount', type: 'number' }, { name: 'account', label: 'Account' }, { name: 'reference_number', label: 'Reference' }, { name: 'notes', label: 'Remarks' }],
};

const meta: Partial<Record<VehicleModule, [string, string]>> = {
  puc: ['🌿', 'Emission & compliance'],
  fitness: ['✓', 'Commercial fitness'],
  permit: ['📄', 'Permit management'],
  tax: ['₹', 'Road tax & receipts'],
  counter_tax: ['₹', 'Counter tax'],
  transfer: ['⇄', 'Ownership transfer'],
  payment: ['₹', 'Customer payment'],
  agent_payment: ['₹', 'Agent settlement'],
  other_payment: ['₹', 'Other transaction'],
  hsrp: ['▣', 'HSRP tracking'],
  sld: ['◉', 'Speed limiter'],
  vltd: ['📡', 'Vehicle tracking device'],
};

const inputClass = 'h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50';
const labelClass = 'grid gap-1.5 text-[11px] font-black uppercase tracking-[.04em] text-slate-500';

export default function VehicleOperationPage() {
  const { vehicleId, module: raw } = useParams<{ vehicleId: string; module: string }>();
  const module = raw as VehicleModule;
  const [rows, setRows] = useState<OperationalRecord[]>([]);
  const [masterOptions, setMasterOptions] = useState<MasterOption[]>([]);
  const [profile, setProfile] = useState<OperationalProfile | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [pucPeriod, setPucPeriod] = useState('');
  const [pucIssueDate, setPucIssueDate] = useState('');
  const [paymentType, setPaymentType] = useState('Receive');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentLedgerId, setPaymentLedgerId] = useState('');
  const [paymentLedgers, setPaymentLedgers] = useState<Ledger[]>([]);

  const masterType = module === 'permit' ? 'permit_type' : module === 'other_payment' ? 'other_payment_category' : '';
  const load = () => vehicleOperationsApi.list(vehicleId, module).then(setRows).catch((e) => setError(e instanceof Error ? e.message : 'History could not be loaded.'));

  const loadPaymentLedgers = async () => {
    const ledgers = await authenticatedRequest<Ledger[]>('/ledgers');
    const usable = ledgers
      .filter((ledger) => ledger.status === 'active' && ['Bank Accounts', 'Cash-in-Hand'].includes(ledger.ledger_group))
      .sort((a, b) => a.ledger_name.localeCompare(b.ledger_name));
    setPaymentLedgers(usable);
    return usable;
  };

  useEffect(() => { void load(); }, [vehicleId, module]);
  useEffect(() => {
    if (module === 'payment') {
      void vehicleOperationsApi.profile(vehicleId).then(setProfile).catch(() => undefined);
      void loadPaymentLedgers().catch(() => setPaymentLedgers([]));
    }
  }, [vehicleId, module]);
  useEffect(() => {
    if (masterType) void vehicleOperationsApi.masters(masterType).then(setMasterOptions);
  }, [masterType]);
  useEffect(() => {
    if (module !== 'payment') return;
    const group = paymentMode === 'cash' ? 'Cash-in-Hand' : 'Bank Accounts';
    const currentStillValid = paymentLedgers.some((ledger) => ledger.id === paymentLedgerId && ledger.ledger_group === group);
    if (!currentStillValid) {
      const first = paymentLedgers.find((ledger) => ledger.ledger_group === group);
      setPaymentLedgerId(first?.id ?? '');
    }
  }, [module, paymentMode, paymentLedgerId, paymentLedgers]);

  async function addMaster() {
    const name = prompt('Enter the new master value');
    if (!name?.trim()) return;
    const added = await vehicleOperationsApi.addMaster(masterType, name.trim());
    setMasterOptions((current) => current.some((x) => x.id === added.id) ? current : [...current, added].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function addPaymentLedger(mode: PaymentMode) {
    const group = mode === 'cash' ? 'Cash-in-Hand' : 'Bank Accounts';
    const suggested = mode === 'cash' ? 'CASH' : '';
    const name = prompt(mode === 'cash' ? 'Cash ledger name (example: CASH / OFFICE CASH)' : 'Bank ledger name (example: HDFC BANK - CURRENT A/C)', suggested);
    if (!name?.trim()) return;
    const openingText = prompt('Opening balance (enter 0 if none)', '0');
    if (openingText === null) return;
    const opening = Number(openingText || 0);
    if (!Number.isFinite(opening) || opening < 0) {
      setError('Opening balance must be zero or a positive amount.');
      return;
    }
    try {
      setError('');
      const created = await authenticatedRequest<Ledger>('/ledgers', {
        method: 'POST',
        body: JSON.stringify({
          ledger_name: name.trim(),
          ledger_group: group,
          opening_balance: opening,
          balance_type: 'debit',
          credit_limit: 0,
          credit_days: 0,
          gst_applicable: false,
          status: 'active',
        }),
      });
      setPaymentMode(mode);
      const ledgers = await loadPaymentLedgers();
      setPaymentLedgerId(ledgers.some((ledger) => ledger.id === created.id) ? created.id : '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ledger could not be created.');
    }
  }

  async function submitGeneric(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const element = event.currentTarget;
    const form = new FormData(element);
    const document = form.get('document');
    form.delete('document');
    const body = Object.fromEntries([...form.entries()].filter(([, value]) => value !== ''));
    try {
      const created = await vehicleOperationsApi.create(vehicleId, module, body);
      if (document instanceof File && document.size) await vehicleOperationsApi.upload(vehicleId, module, created.id, document);
      element.reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Record could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function submitPuc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries([...form.entries()].filter(([, value]) => value !== ''));
    try {
      await vehicleOperationsApi.create(vehicleId, 'puc', body);
      event.currentTarget.reset();
      setPucPeriod('');
      setPucIssueDate('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PUC record could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount') || 0);
    const selectedLedger = paymentLedgers.find((ledger) => ledger.id === paymentLedgerId);
    if (!selectedLedger) {
      setSaving(false);
      setError(`Please select a ${paymentMode === 'cash' ? 'Cash' : 'Bank'} ledger before submitting.`);
      return;
    }
    const body: Record<string, unknown> = {
      payment_type: paymentType,
      ledger_id: selectedLedger.id,
      account: selectedLedger.ledger_name,
      reference_number: form.get('reference_number'),
      issue_date: form.get('issue_date'),
      notes: form.get('notes'),
      ...(paymentType === 'Receive' ? { paid_amount: amount } : { billed_amount: amount }),
    };
    try {
      await vehicleOperationsApi.create(vehicleId, 'payment', body);
      event.currentTarget.reset();
      setPaymentType('Receive');
      setPaymentAmount('');
      await Promise.all([load(), vehicleOperationsApi.profile(vehicleId).then(setProfile)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function edit(row: OperationalRecord) {
    const current = String(row.reference_number ?? row.status ?? '');
    const value = prompt('Update reference/status value', current);
    if (value === null) return;
    const key = row.reference_number !== undefined ? 'reference_number' : 'status';
    await vehicleOperationsApi.update(vehicleId, module, row.id, { [key]: value });
    await load();
  }

  const visible = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
  const m = meta[module] ?? ['◆', 'Vehicle service'];
  const isPaymentFamily = ['payment', 'agent_payment', 'other_payment'].includes(module);
  const pucExpiry = useMemo(() => addMonths(pucIssueDate, Number(pucPeriod || 0)), [pucIssueDate, pucPeriod]);
  const outstanding = Number(profile?.balances.outstanding ?? 0);
  const entered = Number(paymentAmount || 0);
  const projectedBalance = paymentType === 'Receive' ? Math.max(0, outstanding - entered) : outstanding + entered;

  return (
    <main className="min-h-screen bg-[#f4f7fc] p-3 text-[#081a3a] sm:p-5 md:p-7">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="relative overflow-hidden rounded-[28px] border border-[#173d78] bg-[#071a3c] p-5 text-white shadow-[0_24px_70px_rgba(7,26,60,.20)] sm:p-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(43,117,255,.48),transparent_34%),linear-gradient(135deg,#06152f,#0a2555_60%,#0c3478)]" />
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <a href={`/vehicles/${vehicleId}`} className="text-xs font-bold text-blue-200">← Vehicle Profile</a>
              <p className="mt-5 text-[9px] font-black uppercase tracking-[.24em] text-[#63d4ff]">{m[1]}</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{moduleLabels[module] ?? 'Vehicle Operation'}</h1>
              <p className="mt-2 text-xs text-blue-100/70">Add, track and manage every record from one workspace.</p>
            </div>
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[24px] border border-white/10 bg-white/10 text-4xl shadow-inner backdrop-blur sm:h-24 sm:w-24">{m[0]}</div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

        {module === 'puc' ? (
          <PucWorkspace rows={visible} search={search} setSearch={setSearch} period={pucPeriod} setPeriod={setPucPeriod} issueDate={pucIssueDate} setIssueDate={setPucIssueDate} expiry={pucExpiry} saving={saving} onSubmit={submitPuc} onDelete={(id) => confirm('Delete this PUC record?') && vehicleOperationsApi.remove(vehicleId, 'puc', id).then(load)} />
        ) : module === 'payment' ? (
          <PaymentWorkspace rows={visible} search={search} setSearch={setSearch} paymentType={paymentType} setPaymentType={setPaymentType} amount={paymentAmount} setAmount={setPaymentAmount} outstanding={outstanding} projected={projectedBalance} saving={saving} onSubmit={submitPayment} onDelete={(id) => confirm('Delete this payment record?') && vehicleOperationsApi.remove(vehicleId, 'payment', id).then(async () => { await load(); setProfile(await vehicleOperationsApi.profile(vehicleId)); })} paymentMode={paymentMode} setPaymentMode={setPaymentMode} ledgerId={paymentLedgerId} setLedgerId={setPaymentLedgerId} ledgers={paymentLedgers} onAddLedger={addPaymentLedger} />
        ) : (
          <>
            <form onSubmit={submitGeneric} className="overflow-hidden rounded-[26px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.08)]">
              <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/60 px-4 py-4 sm:px-6">
                <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">{isPaymentFamily ? 'Transaction desk' : 'New record'}</p><h2 className="mt-1 text-xl font-black">{isPaymentFamily ? 'Complete Payment' : `Add ${moduleLabels[module] ?? 'Record'}`}</h2></div>
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[9px] font-black uppercase text-blue-700">Secure entry</span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
                {(fields[module] ?? common).map((field) => masterType && ['permit_type', 'purpose'].includes(field.name) ? (
                  <label key={field.name} className={labelClass}><span>{field.label}</span><div className="flex gap-2"><input name={field.name} required={field.required} list={`${masterType}-options`} className={inputClass} /><button type="button" onClick={() => void addMaster()} className="rounded-xl border border-blue-100 bg-blue-50 px-3 font-black text-blue-700">+</button></div><datalist id={`${masterType}-options`}>{masterOptions.map((item) => <option key={item.id} value={item.name} />)}</datalist></label>
                ) : <Field key={field.name} {...field} />)}
                <Field name="document" label="Supporting Document" type="file" />
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-100 bg-[#f8fbff] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-[10px] font-semibold text-slate-500">Review details before submitting. The record will be added to vehicle history.</p><button disabled={saving} className="min-w-[190px] rounded-2xl bg-gradient-to-r from-[#0b2b62] to-[#2563eb] px-6 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(37,99,235,.28)] transition hover:-translate-y-0.5 disabled:opacity-50">{saving ? 'Saving…' : isPaymentFamily ? '✓ Submit Payment' : '✓ Save Record'}</button></div>
            </form>
            {rows[0] && <section className="grid grid-cols-3 gap-2"><Summary label="Current Status" value={String(rows[0].derived_status ?? rows[0].status ?? 'ACTIVE').replaceAll('_', ' ')} /><Summary label="Reference" value={String(rows[0].reference_number ?? rows[0].work_type ?? '—')} /><Summary label="Expiry" value={String(rows[0].expiry_date ?? 'Not applicable')} /></section>}
            <GenericHistory rows={visible} search={search} setSearch={setSearch} vehicleId={vehicleId} module={module} edit={edit} load={load} />
          </>
        )}
      </div>
    </main>
  );
}

function PucWorkspace({ rows, search, setSearch, period, setPeriod, issueDate, setIssueDate, expiry, saving, onSubmit, onDelete }: { rows: OperationalRecord[]; search: string; setSearch: (v: string) => void; period: string; setPeriod: (v: string) => void; issueDate: string; setIssueDate: (v: string) => void; expiry: string; saving: boolean; onSubmit: (e: FormEvent<HTMLFormElement>) => void; onDelete: (id: string) => void }) {
  return <>
    <form onSubmit={onSubmit} className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-[0_18px_50px_rgba(26,64,120,.09)]">
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white via-white to-emerald-50/60 px-5 py-4 sm:px-6"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-emerald-600">Emission certificate</p><h2 className="mt-1 text-xl font-black">Create New PUC</h2></div><span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[9px] font-black uppercase text-emerald-700">Compliance entry</span></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
        <label className={labelClass}>Period *<select name="period" required value={period} onChange={(e) => setPeriod(e.target.value)} className={inputClass}><option value="">Select Period</option><option value="6">6 Month</option><option value="12">12 Month</option></select></label>
        <label className={labelClass}>Issue Date *<input name="issue_date" type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Expire Date *<input name="expiry_date" type="date" required readOnly value={expiry} className={`${inputClass} cursor-not-allowed bg-blue-50/60`} /></label>
        <label className={labelClass}>Party Amount *<div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">₹</span><input name="party_amount" type="number" min="0" step="0.01" required className={`${inputClass} pl-7`} placeholder="0.00" /></div></label>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-[#f8fbff] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-[10px] font-semibold text-slate-500">Expiry date is calculated automatically from the selected PUC period.</p><button disabled={saving || !expiry} className="min-w-[190px] rounded-2xl bg-gradient-to-r from-[#064e3b] to-[#059669] px-6 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(5,150,105,.25)] transition hover:-translate-y-0.5 disabled:opacity-50">{saving ? 'Saving…' : '+ Add PUC'}</button></div>
    </form>
    <section className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.07)]"><HistoryHeader title="PUC Records" count={rows.length} search={search} setSearch={setSearch} /><div className="overflow-x-auto"><table className="min-w-full text-xs sm:text-sm"><thead className="bg-[#f8fbff]"><tr className="text-left text-[9px] font-black uppercase tracking-wide text-slate-400"><th className="p-4">Period</th><th className="p-4">Issue Date</th><th className="p-4">Expire Date</th><th className="p-4">Party Amount</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100 hover:bg-emerald-50/30"><td className="p-4 font-black">{String(row.period ?? '—')} Month</td><td className="p-4">{formatDate(row.issue_date)}</td><td className="p-4">{formatDate(row.expiry_date)}</td><td className="p-4 font-black">₹{Number(row.party_amount ?? 0).toFixed(2)}</td><td className="p-4"><StatusPill value={String(row.derived_status ?? row.status ?? 'ACTIVE')} /></td><td className="p-4"><button type="button" onClick={() => onDelete(row.id)} className="font-black text-rose-600">Delete</button></td></tr>)}</tbody></table>{rows.length === 0 && <Empty />}</div></section>
  </>;
}

function PaymentWorkspace({ rows, search, setSearch, paymentType, setPaymentType, amount, setAmount, outstanding, projected, saving, onSubmit, onDelete, paymentMode, setPaymentMode, ledgerId, setLedgerId, ledgers, onAddLedger }: { rows: OperationalRecord[]; search: string; setSearch: (v: string) => void; paymentType: string; setPaymentType: (v: string) => void; amount: string; setAmount: (v: string) => void; outstanding: number; projected: number; saving: boolean; onSubmit: (e: FormEvent<HTMLFormElement>) => void; onDelete: (id: string) => void; paymentMode: PaymentMode; setPaymentMode: (v: PaymentMode) => void; ledgerId: string; setLedgerId: (v: string) => void; ledgers: Ledger[]; onAddLedger: (mode: PaymentMode) => Promise<void> }) {
  const today = new Date().toISOString().slice(0, 10);
  const group = paymentMode === 'cash' ? 'Cash-in-Hand' : 'Bank Accounts';
  const available = ledgers.filter((ledger) => ledger.ledger_group === group);
  return <>
    <form onSubmit={onSubmit} className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-[0_18px_50px_rgba(26,64,120,.09)]">
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/70 px-5 py-4 sm:px-6"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">Receipt & settlement</p><h2 className="mt-1 text-xl font-black">Payment Process</h2></div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-[9px] font-black uppercase text-blue-700">Ledger controlled</span></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
        <label className={labelClass}>Payment Type *<select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className={inputClass}><option value="Receive">Receive</option><option value="Pay">Pay / Debit</option></select></label>
        <label className={labelClass}>Payment Mode *<select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)} className={inputClass}><option value="cash">Cash</option><option value="bank">Bank / UPI / Online</option></select></label>
        <label className={labelClass}>{paymentMode === 'cash' ? 'Cash Ledger' : 'Bank Ledger'} *<div className="flex gap-2"><select value={ledgerId} onChange={(e) => setLedgerId(e.target.value)} required className={inputClass}><option value="">{available.length ? `Select ${paymentMode === 'cash' ? 'cash' : 'bank'} account` : `No ${paymentMode === 'cash' ? 'cash' : 'bank'} ledger yet`}</option>{available.map((ledger) => <option key={ledger.id} value={ledger.id}>{ledger.ledger_name}</option>)}</select><button type="button" onClick={() => void onAddLedger(paymentMode)} title={`Add ${paymentMode === 'cash' ? 'cash' : 'bank'} ledger`} className="h-12 min-w-12 rounded-xl border border-blue-200 bg-blue-50 text-lg font-black text-blue-700 transition hover:bg-blue-100">+</button></div><span className="normal-case font-semibold tracking-normal text-slate-400">Only active {paymentMode === 'cash' ? 'Cash-in-Hand' : 'Bank Accounts'} ledgers are shown.</span></label>
        <label className={labelClass}>Vou. No<input name="reference_number" className={inputClass} placeholder="Voucher / reference" /></label>
        <label className={labelClass}>Date *<input name="issue_date" type="date" required defaultValue={today} className={inputClass} /></label>
        <label className={labelClass}>Amount *<div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span><input name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0.01" step="0.01" required className={`${inputClass} pl-7`} placeholder="0.00" /></div></label>
        <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>Narration<textarea name="notes" rows={2} className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" placeholder="Enter narration" /></label>
      </div>
      <div className="mx-5 mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-[#f8fbff] p-4 sm:mx-6 sm:grid-cols-3"><BalanceCard label="Current Balance" value={outstanding} /><BalanceCard label={paymentType === 'Receive' ? 'Receiving Now' : 'Adding Debit'} value={Number(amount || 0)} /><BalanceCard label="Closing Balance" value={projected} strong /></div>
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-[#f8fbff] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-[10px] font-semibold text-slate-500">Select the actual Cash/Bank ledger used. This keeps receipts traceable and prevents duplicate account names.</p><button disabled={saving || !ledgerId} className="min-w-[190px] rounded-2xl bg-gradient-to-r from-[#0b2b62] to-[#2563eb] px-6 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(37,99,235,.28)] transition hover:-translate-y-0.5 disabled:opacity-50">{saving ? 'Saving…' : '+ Submit Payment'}</button></div>
    </form>
    <section className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.07)]"><HistoryHeader title="Payment Process Details" count={rows.length} search={search} setSearch={setSearch} /><div className="overflow-x-auto"><table className="min-w-full text-xs sm:text-sm"><thead className="bg-[#f8fbff]"><tr className="text-left text-[9px] font-black uppercase tracking-wide text-slate-400"><th className="p-4">Date</th><th className="p-4">Vou. No</th><th className="p-4">Account Name</th><th className="p-4 text-right">Credit</th><th className="p-4 text-right">Debit</th><th className="p-4">Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100 hover:bg-blue-50/30"><td className="p-4">{formatDate(row.issue_date)}</td><td className="p-4 font-semibold text-blue-700">{String(row.reference_number ?? '—')}</td><td className="p-4"><p className="font-black">{String(row.account ?? '—')}</p><p className="mt-1 text-[10px] text-slate-400">{String(row.notes ?? row.payment_type ?? '')}</p></td><td className="p-4 text-right font-black text-emerald-700">{Number(row.paid_amount ?? 0) ? `₹${Number(row.paid_amount).toFixed(2)}` : '—'}</td><td className="p-4 text-right font-black text-rose-700">{Number(row.billed_amount ?? 0) ? `₹${Number(row.billed_amount).toFixed(2)}` : '—'}</td><td className="p-4"><button type="button" onClick={() => onDelete(row.id)} className="font-black text-rose-600">Delete</button></td></tr>)}</tbody></table>{rows.length === 0 && <Empty />}</div></section>
  </>;
}

function GenericHistory({ rows, search, setSearch, vehicleId, module, edit, load }: { rows: OperationalRecord[]; search: string; setSearch: (v: string) => void; vehicleId: string; module: VehicleModule; edit: (row: OperationalRecord) => Promise<void>; load: () => Promise<void> | void }) {
  return <section className="overflow-hidden rounded-[26px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.07)]"><HistoryHeader title="History" count={rows.length} search={search} setSearch={setSearch} /><div className="overflow-x-auto"><table className="min-w-full text-xs sm:text-sm"><thead className="bg-[#f8fbff]"><tr className="text-left text-[9px] font-black uppercase tracking-wide text-slate-400"><th className="p-4">Reference</th><th className="p-4">Issue</th><th className="p-4">Expiry</th><th className="p-4">Amount</th><th className="p-4">Status</th><th className="p-4">Documents</th><th className="p-4">Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100 transition hover:bg-blue-50/30"><td className="p-4 font-black">{String(row.reference_number ?? row.work_type ?? row.permit_type ?? '—')}</td><td className="p-4 text-slate-600">{String(row.issue_date ?? row.process_date ?? '—')}</td><td className="p-4 text-slate-600">{String(row.expiry_date ?? '—')}</td><td className="p-4 font-black">₹{Number(row.amount ?? row.paid_amount ?? 0).toFixed(2)}</td><td className="p-4"><StatusPill value={String(row.derived_status ?? row.status ?? 'ACTIVE')} /></td><td className="p-4">{row.documents?.map((doc) => <button key={doc.id} onClick={() => void vehicleOperationsApi.downloadDocument(vehicleId, doc)} className="block font-bold text-blue-700 hover:underline">{doc.original_name}</button>) ?? '—'}</td><td className="p-4"><div className="flex gap-3"><button type="button" onClick={() => void edit(row)} className="font-black text-blue-700">Edit</button><button type="button" onClick={() => confirm('Delete this history record?') && vehicleOperationsApi.remove(vehicleId, module, row.id).then(() => load())} className="font-black text-red-600">Delete</button></div></td></tr>)}</tbody></table>{rows.length === 0 && <Empty />}</div></section>;
}

function HistoryHeader({ title, count, search, setSearch }: { title: string; count: number; search: string; setSearch: (v: string) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/30 px-4 py-4 sm:px-6"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">Timeline</p><h2 className="mt-1 text-xl font-black">{title}</h2></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-black uppercase text-slate-500">{count} Records</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search history" className="w-40 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-400 sm:w-56" /></div></div>;
}

function Field({ name, label, type = 'text', required = false }: FieldSpec) {
  return <label className={labelClass}><span>{label}</span><input name={name} type={type} required={required} accept={type === 'file' ? '.pdf,.jpg,.jpeg,.png' : undefined} step={type === 'number' ? '0.01' : undefined} className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-bold file:text-blue-700`} /></label>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-[20px] border border-[#d9e5f7] bg-white p-3 shadow-sm sm:p-5"><p className="text-[8px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 truncate text-xs font-black sm:text-lg">{value}</p></div>;
}

function BalanceCard({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <div className={`rounded-xl border p-3 ${strong ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-xl font-black ${strong ? 'text-blue-700' : 'text-slate-900'}`}>₹{value.toFixed(2)}</p></div>;
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.replaceAll('_', ' ').toUpperCase();
  const danger = normalized.includes('EXPIRED') || normalized.includes('OVERDUE');
  return <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${danger ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{normalized}</span>;
}

function Empty() {
  return <p className="p-10 text-center text-sm font-semibold text-slate-400">No records added yet.</p>;
}

function addMonths(value: string, months: number) {
  if (!value || !months) return '';
  const date = new Date(`${value}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB');
}
