'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createWorker } from 'tesseract.js';
import { Customer, customerApi } from '@/lib/customers';
import { Vehicle, vehicleApi } from '@/lib/vehicles';

type Values = Record<string, string>;

const initial: Values = {
  customer_id: '', vehicle_number: '', registration_date: '', registration_authority: '', state: 'Gujarat', district: '', vehicle_type: 'two_wheeler',
  vehicle_class: '', vehicle_category: '', manufacturer: '', model: '', variant: '', manufacturing_year: '', colour: '', fuel_type: '',
  seating_capacity: '', cubic_capacity: '', gross_weight: '', unladen_weight: '', chassis_number: '', engine_number: '', financier: '',
  insurance_status: 'not_added', fitness_status: 'not_added', permit_status: 'not_added', tax_status: 'not_added', puc_status: 'not_added',
  insurance_expiry: '', puc_expiry: '', fitness_expiry: '', permit_expiry: '', national_permit_expiry: '', tax_expiry: '', counter_tax_expiry: '', payment_due: '0',
};

const LABELS = /regn|registration|chassis|engine|motor|owner|fuel|emission|address|vehicle class|maker|model|colour|color|body type|seating|capacity|unladen|gross|cubic|horse power|wheel base|month-year|cylinders|financier|authority/i;

function cleanLine(value: string) {
  return value
    .replace(/[|{}<>©®]/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/^[:;,._\-\s]+|[:;,._\-\s]+$/g, '')
    .trim();
}

function cleanTextValue(value: string) {
  return cleanLine(value)
    .replace(/^(name|no|number|type|capacity)\s*[:.-]?\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isUsefulValue(value: string) {
  const v = cleanTextValue(value);
  return v.length >= 2 && !LABELS.test(v) && !/^[:/\\~`'"-]+$/.test(v);
}

function valueAfterLabel(lines: string[], labels: RegExp[], maxLookAhead = 3) {
  for (let i = 0; i < lines.length; i++) {
    for (const label of labels) {
      if (!label.test(lines[i])) continue;

      const sameLine = lines[i].replace(label, '').replace(/^\s*[:./-]\s*/, '').trim();
      if (isUsefulValue(sameLine)) return cleanTextValue(sameLine);

      for (let step = 1; step <= maxLookAhead; step++) {
        const next = lines[i + step];
        if (!next) break;
        if (isUsefulValue(next)) return cleanTextValue(next);
      }
    }
  }
  return '';
}

function normalizeDate(value: string) {
  const m = value.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function numeric(value: string, pattern: RegExp) {
  return value.match(pattern)?.[0] ?? '';
}

function parseRc(text: string): Partial<Values> {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const joined = lines.join('\n');
  const out: Partial<Values> = {};

  const reg = joined.match(/\bGJ\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4}\b/i) ?? joined.match(/\b[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4}\b/i);
  if (reg) out.vehicle_number = reg[0].replace(/[^A-Z0-9]/gi, '').toUpperCase();

  const regDateLine = lines.find((line) => /date of regn|date of registration|regn\.? date/i.test(line));
  if (regDateLine) {
    const date = normalizeDate(regDateLine) || normalizeDate(lines[lines.indexOf(regDateLine) + 1] ?? '');
    if (date) out.registration_date = date;
  }

  const chassisRaw = valueAfterLabel(lines, [/chassis\s*(?:no|number)?/i]);
  const chassis = chassisRaw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (/^[A-Z0-9]{15,25}$/.test(chassis)) out.chassis_number = chassis;

  const engineRaw = valueAfterLabel(lines, [/engine\s*\/\s*motor\s*(?:no|number)?/i, /engine\s*(?:no|number)?/i, /motor\s*(?:no|number)?/i]);
  const engine = engineRaw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (/^[A-Z0-9]{8,25}$/.test(engine)) out.engine_number = engine;

  const vehicleClass = valueAfterLabel(lines, [/vehicle\s*class/i, /class\s*of\s*vehicle/i]);
  if (vehicleClass && /cycle|scooter|car|goods|taxi|passenger|vehicle/i.test(vehicleClass)) out.vehicle_class = vehicleClass.toUpperCase();

  const maker = valueAfterLabel(lines, [/maker'?s?\s*name/i, /manufacturer/i]);
  if (maker && /[A-Za-z]{3}/.test(maker)) out.manufacturer = maker.toUpperCase();

  const model = valueAfterLabel(lines, [/model\s*name/i, /^model$/i]);
  if (model && /[A-Za-z0-9]{2}/.test(model)) out.model = model.toUpperCase();

  const colour = valueAfterLabel(lines, [/colour/i, /color/i]);
  if (colour && /[A-Za-z]{3}/.test(colour) && colour.length <= 40) out.colour = colour.toUpperCase();

  const body = valueAfterLabel(lines, [/body\s*type/i]);
  if (body && /[A-Za-z]{3}/.test(body) && body.length <= 50) out.vehicle_category = body.toUpperCase();

  const fuel = joined.match(/\b(PETROL|DIESEL|CNG|LPG|ELECTRIC|BATTERY|EV)\b/i);
  if (fuel) out.fuel_type = /electric|battery|ev/i.test(fuel[1]) ? 'electric' : fuel[1].toLowerCase();

  const seatingRaw = valueAfterLabel(lines, [/seating\s*\(in\s*all\)\s*capacity/i, /seating\s*capacity/i]);
  const seating = numeric(seatingRaw, /\b\d{1,2}\b/);
  if (seating) out.seating_capacity = seating;

  const ccRaw = valueAfterLabel(lines, [/cubic\s*cap(?:acity)?(?:\s*\/\s*horse\s*power.*)?/i]);
  const cc = numeric(ccRaw, /\b\d{2,5}(?:\.\d{1,2})?\b/);
  if (cc) out.cubic_capacity = cc;

  const unladenRaw = valueAfterLabel(lines, [/unladen\s*weight/i]);
  const unladen = numeric(unladenRaw, /\b\d{2,6}\b/);
  if (unladen) out.unladen_weight = unladen;

  const grossRaw = valueAfterLabel(lines, [/gross\s*(?:vehicle\s*)?weight/i]);
  const gross = numeric(grossRaw, /\b\d{3,6}\b/);
  if (gross) out.gross_weight = gross;

  const financier = valueAfterLabel(lines, [/financier/i]);
  if (financier && /[A-Za-z]{3}/.test(financier)) out.financier = financier.toUpperCase();

  const authority = valueAfterLabel(lines, [/registration\s*authority/i, /registering\s*authority/i]);
  if (authority && /[A-Za-z]{3}/.test(authority)) {
    out.registration_authority = authority.toUpperCase();
    out.district = authority.toUpperCase();
  }

  const monthYearLine = lines.find((line) => /month[- ]?year\s*of\s*mfg/i.test(line));
  if (monthYearLine) {
    const nearby = `${monthYearLine} ${lines[lines.indexOf(monthYearLine) + 1] ?? ''}`;
    const year = nearby.match(/(?:0?[1-9]|1[0-2])[-/]?(19\d{2}|20\d{2})/)?.[1] ?? nearby.match(/\b(19\d{2}|20\d{2})\b/)?.[1];
    if (year) out.manufacturing_year = year;
  }

  const classText = `${out.vehicle_class ?? ''} ${out.vehicle_category ?? ''}`.toLowerCase();
  if (/m-?cycle|motor\s*cycle|scooter|2wn|two\s*wheeler/.test(classText)) out.vehicle_type = 'two_wheeler';
  else if (/hgv|heavy\s*goods|truck|trailer/.test(classText)) out.vehicle_type = 'hgv';
  else if (/lgv|light\s*goods|pickup|pick-up/.test(classText)) out.vehicle_type = 'lgv';
  else if (/taxi|cab|maxi|passenger/.test(classText)) out.vehicle_type = 'taxi';
  else if (/motor\s*car|private\s*car|lmv/.test(classText)) out.vehicle_type = 'private_car';

  return Object.fromEntries(Object.entries(out).filter(([, value]) => value !== undefined && value !== ''));
}

async function preprocess(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(1, Math.min(3.5, 2600 / bitmap.width));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const gray = image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114;
    const value = gray > 185 ? 255 : gray < 65 ? 0 : Math.round((gray - 65) * 2.35);
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
  }
  ctx.putImageData(image, 0, 0);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), 'image/png', 1));
}

export function VehicleForm({ vehicle }: { vehicle?: Partial<Vehicle> }) {
  const router = useRouter();
  const [mode, setMode] = useState<'rc' | 'manual'>('manual');
  const [values, setValues] = useState<Values>(() => ({ ...initial, ...Object.fromEntries(Object.entries(vehicle ?? {}).map(([k, v]) => [k, v == null ? '' : String(v).slice(0, 10)])) }));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);

  useEffect(() => {
    customerApi.list('?per_page=500').then((r) => setCustomers(r.data ?? [])).catch((e) => setError(e instanceof Error ? e.message : 'Customers load nahi hue.'));
  }, []);

  const set = (name: string, value: string) => setValues((old) => ({ ...old, [name]: value }));

  async function readRc() {
    if (!front && !back) { setError('Pehle RC front ya back upload karo.'); return; }
    setReading(true); setProgress(0); setError(''); setSuccess('');
    const worker = await createWorker('eng', 1, { logger: (m) => { if (m.status === 'recognizing text') setProgress(Math.round((m.progress ?? 0) * 100)); } });
    try {
      let text = '';
      if (front) text += `${(await worker.recognize(await preprocess(front))).data.text}\n`;
      if (back) text += (await worker.recognize(await preprocess(back))).data.text;
      const extracted = parseRc(text);
      const count = Object.keys(extracted).length;
      setValues((old) => ({ ...old, ...extracted, customer_id: old.customer_id }));
      setSuccess(count ? `RC se ${count} clear details fill ho gayi. Customer selection same rakhi gayi.` : 'RC text read hua, lekin clear details nahi mili. Manual entry use karo.');
    } catch (e) {
      console.error(e);
      setError('RC clear read nahi hui. Manual entry available hai.');
    } finally {
      await worker.terminate();
      setReading(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const body = {
        ...values,
        hypothecation: Boolean(values.financier),
        manufacturing_year: values.manufacturing_year ? Number(values.manufacturing_year) : null,
        seating_capacity: values.seating_capacity ? Number(values.seating_capacity) : null,
        cubic_capacity: values.cubic_capacity ? Number(values.cubic_capacity) : null,
        gross_weight: values.gross_weight ? Number(values.gross_weight) : null,
        unladen_weight: values.unladen_weight ? Number(values.unladen_weight) : null,
        payment_due: Number(values.payment_due || 0),
      };
      const saved = vehicle?.id ? await vehicleApi.update(vehicle.id, body) : await vehicleApi.create(body);
      router.push(`/vehicles/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vehicle save nahi hua.');
    } finally {
      setSaving(false);
    }
  }

  const commercial = ['lgv', 'hgv', 'taxi'].includes(values.vehicle_type);
  const hgv = values.vehicle_type === 'hgv';
  const taxi = values.vehicle_type === 'taxi';

  return <form onSubmit={submit} className="space-y-6 pb-24">
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="bg-gradient-to-r from-slate-950 to-blue-800 p-6 text-white"><h1 className="text-2xl font-bold">{vehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h1><p className="mt-1 text-blue-100">Customer manually select hoga. RC OCR sirf vehicle details fill karega.</p></div>
      <div className="grid gap-3 p-5 md:grid-cols-2"><Mode active={mode === 'rc'} title="RC Book Upload" text="Front/back OCR se vehicle details auto-fill." onClick={() => setMode('rc')} /><Mode active={mode === 'manual'} title="Manual Entry" text="Saari details manually bhar sakte ho." onClick={() => setMode('manual')} /></div>
      {mode === 'rc' && <div className="grid gap-4 border-t p-5 md:grid-cols-2"><FileBox label="RC Front" onChange={setFront} /><FileBox label="RC Back" onChange={setBack} /><button type="button" onClick={readRc} disabled={reading} className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white md:col-span-2">{reading ? `Reading RC... ${progress}%` : 'Read RC Details'}</button></div>}
    </section>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
    {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{success}</div>}

    <Card title="Owner & Basic Details"><Select label="Customer" value={values.customer_id} onChange={(v) => set('customer_id', v)} required options={customers.map((c) => ({ value: c.id, label: `${c.first_name} ${c.middle_name ?? ''} ${c.last_name} — ${c.mobile}` }))} /><Input label="Vehicle Number" value={values.vehicle_number} onChange={(v) => set('vehicle_number', v.toUpperCase())} required /><Input label="Registration Date" type="date" value={values.registration_date} onChange={(v) => set('registration_date', v)} /><Input label="Registration Authority" value={values.registration_authority} onChange={(v) => set('registration_authority', v)} /><Input label="State" value={values.state} onChange={(v) => set('state', v)} /><Input label="District" value={values.district} onChange={(v) => set('district', v)} /><Select label="Vehicle Type" value={values.vehicle_type} onChange={(v) => set('vehicle_type', v)} options={[{ value: 'two_wheeler', label: 'Motorcycle / Scooter' }, { value: 'private_car', label: 'Private Car' }, { value: 'lgv', label: 'LGV / Pickup' }, { value: 'hgv', label: 'HGV / GT' }, { value: 'taxi', label: 'Taxi' }]} /></Card>

    <Card title="Vehicle Details"><Input label="Vehicle Class" value={values.vehicle_class} onChange={(v) => set('vehicle_class', v)} /><Input label="Vehicle Category / Body Type" value={values.vehicle_category} onChange={(v) => set('vehicle_category', v)} /><Input label="Manufacturer" value={values.manufacturer} onChange={(v) => set('manufacturer', v)} /><Input label="Model" value={values.model} onChange={(v) => set('model', v)} /><Input label="Variant" value={values.variant} onChange={(v) => set('variant', v)} /><Input label="Manufacturing Year" type="number" value={values.manufacturing_year} onChange={(v) => set('manufacturing_year', v)} /><Input label="Colour" value={values.colour} onChange={(v) => set('colour', v)} /><Input label="Fuel Type" value={values.fuel_type} onChange={(v) => set('fuel_type', v)} /><Input label="Seating Capacity" type="number" value={values.seating_capacity} onChange={(v) => set('seating_capacity', v)} /><Input label="Cubic Capacity" type="number" value={values.cubic_capacity} onChange={(v) => set('cubic_capacity', v)} />{commercial && <><Input label="Gross Weight" type="number" value={values.gross_weight} onChange={(v) => set('gross_weight', v)} /><Input label="Unladen Weight" type="number" value={values.unladen_weight} onChange={(v) => set('unladen_weight', v)} /></>}</Card>

    <Card title="Identification & Finance"><Input label="Chassis Number" value={values.chassis_number} onChange={(v) => set('chassis_number', v.toUpperCase())} required /><Input label="Engine Number" value={values.engine_number} onChange={(v) => set('engine_number', v.toUpperCase())} required /><Input label="Financier / Hypothecation" value={values.financier} onChange={(v) => set('financier', v)} /><Input label="Payment Due" type="number" value={values.payment_due} onChange={(v) => set('payment_due', v)} /></Card>

    <Card title="Compliance & Expiry"><Expiry label="Insurance" status={values.insurance_status} expiry={values.insurance_expiry} setStatus={(v) => set('insurance_status', v)} setExpiry={(v) => set('insurance_expiry', v)} /><Expiry label="PUC" status={values.puc_status} expiry={values.puc_expiry} setStatus={(v) => set('puc_status', v)} setExpiry={(v) => set('puc_expiry', v)} />{commercial && <Expiry label="Fitness" status={values.fitness_status} expiry={values.fitness_expiry} setStatus={(v) => set('fitness_status', v)} setExpiry={(v) => set('fitness_expiry', v)} />}{(hgv || taxi) && <><Expiry label="Permit" status={values.permit_status} expiry={values.permit_expiry} setStatus={(v) => set('permit_status', v)} setExpiry={(v) => set('permit_expiry', v)} /><Expiry label="National Permit" status={values.permit_status} expiry={values.national_permit_expiry} setStatus={(v) => set('permit_status', v)} setExpiry={(v) => set('national_permit_expiry', v)} /></>}{hgv && <><Expiry label="Tax" status={values.tax_status} expiry={values.tax_expiry} setStatus={(v) => set('tax_status', v)} setExpiry={(v) => set('tax_expiry', v)} /><Expiry label="Counter Tax" status={values.tax_status} expiry={values.counter_tax_expiry} setStatus={(v) => set('tax_status', v)} setExpiry={(v) => set('counter_tax_expiry', v)} /></>}</Card>

    <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-end border-t bg-white/95 p-4 backdrop-blur lg:left-[260px]"><button disabled={saving} className="rounded-xl bg-blue-700 px-7 py-3 font-semibold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save Vehicle'}</button></div>
  </form>;
}

function Mode({ active, title, text, onClick }: { active: boolean; title: string; text: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-xl border p-4 text-left ${active ? 'border-blue-600 bg-blue-50' : 'bg-white'}`}><b>{title}</b><p className="text-sm text-slate-500">{text}</p></button>; }
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-bold">{title}</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div></section>; }
function Input({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) { return <label className="text-sm font-semibold">{label}{required && <span className="text-red-500"> *</span>}<input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>; }
function Select({ label, value, onChange, options, required = false }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean }) { return <label className="text-sm font-semibold">{label}{required && <span className="text-red-500"> *</span>}<select value={value} required={required} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="">Select</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>; }
function FileBox({ label, onChange }: { label: string; onChange: (f: File | null) => void }) { return <label className="rounded-xl border border-dashed p-5 text-sm font-semibold">{label}<input type="file" accept="image/*" onChange={(e) => onChange(e.target.files?.[0] ?? null)} className="mt-3 block w-full text-sm font-normal" /></label>; }
function Expiry({ label, status, expiry, setStatus, setExpiry }: { label: string; status: string; expiry: string; setStatus: (v: string) => void; setExpiry: (v: string) => void }) { return <div className="rounded-xl border bg-slate-50 p-4"><p className="font-semibold">{label}</p><select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-3 w-full rounded-lg border bg-white p-2"><option value="not_added">Not Added</option><option value="active">Active</option><option value="valid">Valid</option><option value="expiring_soon">Expiring Soon</option><option value="expired">Expired</option><option value="paid">Paid</option><option value="due">Due</option><option value="overdue">Overdue</option></select><input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="mt-3 w-full rounded-lg border p-2" /></div>; }
