'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createWorker } from 'tesseract.js';
import { Customer, customerApi } from '@/lib/customers';
import { Vehicle, vehicleApi } from '@/lib/vehicles';

type Mode = 'rc' | 'manual';
type Values = Record<string, string>;

const initial: Values = {
  customer_id: '', vehicle_number: '', registration_date: '', registration_authority: '', state: '', district: '',
  vehicle_type: 'private_car', vehicle_class: '', vehicle_category: '', manufacturer: '', model: '', variant: '',
  manufacturing_year: '', colour: '', fuel_type: '', seating_capacity: '', cubic_capacity: '', gross_weight: '',
  unladen_weight: '', chassis_number: '', engine_number: '', financier: '', insurance_status: 'not_added',
  fitness_status: 'not_added', permit_status: 'not_added', tax_status: 'not_added', puc_status: 'not_added',
  insurance_expiry: '', puc_expiry: '', fitness_expiry: '', permit_expiry: '', national_permit_expiry: '',
  tax_expiry: '', counter_tax_expiry: '', payment_due: '0',
};

function clean(value: string) {
  return value.replace(/[|_{}\[\]<>]/g, ' ').replace(/\s+/g, ' ').trim();
}

function dateValue(value: string) {
  const match = value.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  if (!match) return '';
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

function labelled(lines: string[], labels: RegExp, max = 40) {
  for (let i = 0; i < lines.length; i++) {
    if (!labels.test(lines[i])) continue;
    const sameLine = clean(lines[i].replace(labels, '').replace(/^\s*[:\-.]\s*/, ''));
    if (sameLine.length >= 2 && sameLine.length <= max) return sameLine;
    const nextLine = clean(lines[i + 1] ?? '');
    if (nextLine.length >= 2 && nextLine.length <= max) return nextLine;
  }
  return '';
}

function parseRc(text: string): Partial<Values> {
  const upper = text.toUpperCase();
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const out: Partial<Values> = {};

  const registrationPatterns = [
    /\b[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{3,4}\b/,
    /\b[A-Z]{2}\d{2}[A-Z]{2}\d{4}\b/,
  ];
  for (const pattern of registrationPatterns) {
    const match = upper.match(pattern);
    if (match) {
      out.vehicle_number = match[0].replace(/[\s-]/g, '');
      break;
    }
  }

  const chassisLabel = labelled(lines, /(?:CHASSIS\s*(?:NO|NUMBER)?|CH\.?\s*NO\.?)/i, 30);
  const chassisFallback = upper.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
  const chassis = (chassisLabel.match(/[A-Z0-9]{12,25}/i)?.[0] ?? chassisFallback?.[0] ?? '').toUpperCase();
  if (chassis) out.chassis_number = chassis;

  const engineLabel = labelled(lines, /(?:ENGINE\s*(?:NO|NUMBER)?|ENG\.?\s*NO\.?)/i, 30);
  const engine = engineLabel.match(/[A-Z0-9-]{5,25}/i)?.[0]?.toUpperCase() ?? '';
  if (engine && engine !== chassis) out.engine_number = engine;

  const maker = labelled(lines, /(?:MAKER(?:'S)?\s*(?:NAME)?|MANUFACTURER)/i, 60);
  if (maker) out.manufacturer = maker;

  const model = labelled(lines, /(?:MAKER'?S?\s*MODEL|MODEL(?:\s*NAME)?)/i, 50);
  if (model) out.model = model;

  const variant = labelled(lines, /(?:VARIANT|TYPE)/i, 40);
  if (variant && !/BODY|VEHICLE|FUEL/i.test(variant)) out.variant = variant;

  const vehicleClass = labelled(lines, /(?:VEHICLE\s*CLASS|CLASS\s*OF\s*VEHICLE|CLASS)/i, 55);
  if (vehicleClass) {
    out.vehicle_class = vehicleClass;
    const cls = vehicleClass.toUpperCase();
    if (/HGV|HEAVY|GOODS CARRIAGE|TRUCK|TRAILER/.test(cls)) out.vehicle_type = 'hgv';
    else if (/LGV|LIGHT GOODS|PICKUP|PICK UP/.test(cls)) out.vehicle_type = 'lgv';
    else if (/TAXI|CAB|MOTOR CAB/.test(cls)) out.vehicle_type = 'taxi';
    else if (/MOTOR CYCLE|SCOOTER|TWO WHEELER/.test(cls)) out.vehicle_type = 'two_wheeler';
    else if (/MOTOR CAR|PRIVATE|LMV/.test(cls)) out.vehicle_type = 'private_car';
  }

  const bodyType = labelled(lines, /(?:BODY\s*TYPE|VEHICLE\s*CATEGORY)/i, 40);
  if (bodyType) out.vehicle_category = bodyType;

  const fuel = upper.match(/\b(PETROL|DIESEL|CNG|LPG|ELECTRIC|BATTERY|EV|HYBRID)\b/);
  if (fuel) out.fuel_type = fuel[1].toLowerCase();

  const colour = labelled(lines, /COLouR|COLOR/i, 30);
  if (colour) out.colour = colour;

  const authority = labelled(lines, /(?:REGISTERING\s*AUTHORITY|REGISTRATION\s*AUTHORITY|RTO)/i, 50);
  if (authority) out.registration_authority = authority;

  const seating = labelled(lines, /(?:SEATING\s*CAPACITY|SEAT(?:ING)?\s*CAP)/i, 10).match(/\d{1,3}/)?.[0];
  if (seating) out.seating_capacity = seating;

  const cubic = labelled(lines, /(?:CUBIC\s*CAPACITY|CUBIC\s*CAP|CC)/i, 12).match(/\d{2,5}/)?.[0];
  if (cubic) out.cubic_capacity = cubic;

  const gross = labelled(lines, /(?:GROSS\s*VEHICLE\s*WEIGHT|GROSS\s*WEIGHT|GVW)/i, 15).match(/\d{3,6}/)?.[0];
  if (gross) out.gross_weight = gross;

  const unladen = labelled(lines, /(?:UNLADEN\s*WEIGHT|ULW)/i, 15).match(/\d{3,6}/)?.[0];
  if (unladen) out.unladen_weight = unladen;

  const year = labelled(lines, /(?:MONTH\s*&?\s*YEAR\s*OF\s*MFG|YEAR\s*OF\s*MANUFACTURE|MFG\.?\s*YEAR)/i, 20).match(/(?:19|20)\d{2}/)?.[0];
  if (year) out.manufacturing_year = year;

  const registrationLine = lines.find((line) => /REGN\.?\s*DATE|REGISTRATION\s*DATE|DATE\s*OF\s*REGISTRATION/i.test(line));
  const registrationDate = registrationLine ? dateValue(registrationLine) : '';
  if (registrationDate) out.registration_date = registrationDate;

  const expiryRules: Array<[keyof Values, RegExp]> = [
    ['insurance_expiry', /INSURANCE(?:\s*UPTO|\s*VALID(?:ITY)?|\s*EXPIRY)?/i],
    ['puc_expiry', /(?:PUC|POLLUTION)(?:\s*UPTO|\s*VALID(?:ITY)?|\s*EXPIRY)?/i],
    ['fitness_expiry', /FITNESS(?:\s*UPTO|\s*VALID(?:ITY)?|\s*EXPIRY)?/i],
    ['permit_expiry', /^(?!.*NATIONAL).*PERMIT(?:\s*UPTO|\s*VALID(?:ITY)?|\s*EXPIRY)?/i],
    ['national_permit_expiry', /NATIONAL\s*PERMIT(?:\s*UPTO|\s*VALID(?:ITY)?|\s*EXPIRY)?/i],
    ['tax_expiry', /(?:TAX\s*UPTO|TAX\s*VALID(?:ITY)?|TAX\s*EXPIRY)/i],
  ];
  for (const [key, rule] of expiryRules) {
    const lineIndex = lines.findIndex((line) => rule.test(line));
    if (lineIndex < 0) continue;
    const value = dateValue(`${lines[lineIndex]} ${lines[lineIndex + 1] ?? ''}`);
    if (value) out[key] = value;
  }

  return out;
}

export function VehicleForm({ vehicle }: { vehicle?: Partial<Vehicle> }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('manual');
  const [values, setValues] = useState<Values>(() => ({
    ...initial,
    ...Object.fromEntries(Object.entries(vehicle ?? {}).map(([key, value]) => [key, value == null ? '' : String(value).slice(0, 10)])),
  }));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);

  useEffect(() => {
    customerApi.list('?per_page=500').then((response) => setCustomers(response.data ?? [])).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Customers load nahi hue.'));
  }, []);

  function set(name: string, value: string) {
    setValues((old) => ({ ...old, [name]: value }));
  }

  async function readRc() {
    if (!front && !back) { setError('Pehle RC front ya back upload karo.'); return; }
    setReading(true); setError(''); setSuccess('');
    const worker = await createWorker('eng');
    try {
      let text = '';
      if (front) text += `${(await worker.recognize(front)).data.text}\n`;
      if (back) text += (await worker.recognize(back)).data.text;
      const extracted = parseRc(text);
      setValues((old) => ({ ...old, ...extracted, customer_id: old.customer_id }));
      const count = Object.values(extracted).filter(Boolean).length;
      setSuccess(count ? `RC se ${count} details fill ho gayi. Customer selection change nahi hui.` : 'RC read hui, lekin clear fields nahi mile. Manual entry se details bhar sakte ho.');
    } catch (requestError) {
      console.error(requestError);
      setError('RC clear read nahi hui. Manual entry se details bhar sakte ho.');
    } finally {
      await worker.terminate(); setReading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
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
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Vehicle save nahi hua.');
    } finally { setSaving(false); }
  }

  const commercial = ['lgv', 'hgv', 'taxi'].includes(values.vehicle_type);
  const hgv = values.vehicle_type === 'hgv';
  const taxi = values.vehicle_type === 'taxi';

  return <form onSubmit={submit} className="space-y-6 pb-24">
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="bg-gradient-to-r from-slate-950 to-blue-800 p-6 text-white"><h1 className="text-2xl font-bold">{vehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h1><p className="mt-1 text-blue-100">Customer manually select hoga. RC OCR sirf vehicle details fill karega.</p></div>
      <div className="grid gap-3 p-5 md:grid-cols-2"><ModeButton active={mode === 'rc'} title="RC Book Upload" text="Front/back OCR se vehicle details auto-fill." onClick={() => setMode('rc')} /><ModeButton active={mode === 'manual'} title="Manual Entry" text="Saari details manually bhar sakte ho." onClick={() => setMode('manual')} /></div>
      {mode === 'rc' && <div className="grid gap-4 border-t p-5 md:grid-cols-2"><FileBox label="RC Front" onChange={setFront} /><FileBox label="RC Back" onChange={setBack} /><button type="button" onClick={readRc} disabled={reading} className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white md:col-span-2 disabled:opacity-60">{reading ? 'Reading RC...' : 'Read RC Details'}</button></div>}
    </section>

    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
    {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{success}</div>}

    <Card title="Owner & Basic Details">
      <Select label="Customer" value={values.customer_id} onChange={(value) => set('customer_id', value)} required options={customers.map((customer) => ({ value: customer.id, label: `${customer.first_name} ${customer.middle_name ?? ''} ${customer.last_name} — ${customer.mobile}` }))} />
      <Input label="Vehicle Number" value={values.vehicle_number} onChange={(value) => set('vehicle_number', value.toUpperCase())} required />
      <Input label="Registration Date" type="date" value={values.registration_date} onChange={(value) => set('registration_date', value)} />
      <Input label="Registration Authority" value={values.registration_authority} onChange={(value) => set('registration_authority', value)} />
      <Input label="State" value={values.state} onChange={(value) => set('state', value)} />
      <Input label="District" value={values.district} onChange={(value) => set('district', value)} />
      <Select label="Vehicle Type" value={values.vehicle_type} onChange={(value) => set('vehicle_type', value)} options={[{ value: 'private_car', label: 'Private Car' }, { value: 'lgv', label: 'LGV / Pickup' }, { value: 'hgv', label: 'HGV / GT' }, { value: 'taxi', label: 'Taxi' }, { value: 'two_wheeler', label: 'Two Wheeler' }]} />
    </Card>

    <Card title="Vehicle Details">
      <Input label="Vehicle Class" value={values.vehicle_class} onChange={(value) => set('vehicle_class', value)} /><Input label="Vehicle Category / Body Type" value={values.vehicle_category} onChange={(value) => set('vehicle_category', value)} /><Input label="Manufacturer" value={values.manufacturer} onChange={(value) => set('manufacturer', value)} /><Input label="Model" value={values.model} onChange={(value) => set('model', value)} /><Input label="Variant" value={values.variant} onChange={(value) => set('variant', value)} /><Input label="Manufacturing Year" type="number" value={values.manufacturing_year} onChange={(value) => set('manufacturing_year', value)} /><Input label="Colour" value={values.colour} onChange={(value) => set('colour', value)} /><Input label="Fuel Type" value={values.fuel_type} onChange={(value) => set('fuel_type', value)} /><Input label="Seating Capacity" type="number" value={values.seating_capacity} onChange={(value) => set('seating_capacity', value)} /><Input label="Cubic Capacity" type="number" value={values.cubic_capacity} onChange={(value) => set('cubic_capacity', value)} />{commercial && <><Input label="Gross Weight" type="number" value={values.gross_weight} onChange={(value) => set('gross_weight', value)} /><Input label="Unladen Weight" type="number" value={values.unladen_weight} onChange={(value) => set('unladen_weight', value)} /></>}
    </Card>

    <Card title="Identification & Finance"><Input label="Chassis Number" value={values.chassis_number} onChange={(value) => set('chassis_number', value.toUpperCase())} required /><Input label="Engine Number" value={values.engine_number} onChange={(value) => set('engine_number', value.toUpperCase())} required /><Input label="Financier / Hypothecation" value={values.financier} onChange={(value) => set('financier', value)} /><Input label="Payment Due" type="number" value={values.payment_due} onChange={(value) => set('payment_due', value)} /></Card>

    <Card title="Compliance & Expiry"><Expiry label="Insurance" status={values.insurance_status} expiry={values.insurance_expiry} setStatus={(value) => set('insurance_status', value)} setExpiry={(value) => set('insurance_expiry', value)} /><Expiry label="PUC" status={values.puc_status} expiry={values.puc_expiry} setStatus={(value) => set('puc_status', value)} setExpiry={(value) => set('puc_expiry', value)} />{commercial && <Expiry label="Fitness" status={values.fitness_status} expiry={values.fitness_expiry} setStatus={(value) => set('fitness_status', value)} setExpiry={(value) => set('fitness_expiry', value)} />}{(hgv || taxi) && <><Expiry label="Permit" status={values.permit_status} expiry={values.permit_expiry} setStatus={(value) => set('permit_status', value)} setExpiry={(value) => set('permit_expiry', value)} /><Expiry label="National Permit" status={values.permit_status} expiry={values.national_permit_expiry} setStatus={(value) => set('permit_status', value)} setExpiry={(value) => set('national_permit_expiry', value)} /></>}{hgv && <><Expiry label="Tax" status={values.tax_status} expiry={values.tax_expiry} setStatus={(value) => set('tax_status', value)} setExpiry={(value) => set('tax_expiry', value)} /><Expiry label="Counter Tax" status={values.tax_status} expiry={values.counter_tax_expiry} setStatus={(value) => set('tax_status', value)} setExpiry={(value) => set('counter_tax_expiry', value)} /></>}</Card>

    <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-end border-t bg-white/95 p-4 backdrop-blur lg:left-[260px]"><button disabled={saving} className="rounded-xl bg-blue-700 px-7 py-3 font-semibold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save Vehicle'}</button></div>
  </form>;
}

function ModeButton({ active, title, text, onClick }: { active: boolean; title: string; text: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-xl border p-4 text-left ${active ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'bg-white'}`}><b>{title}</b><p className="text-sm text-slate-500">{text}</p></button>; }
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-bold">{title}</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div></section>; }
function Input({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="text-sm font-semibold">{label}{required && <span className="text-red-500"> *</span>}<input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>; }
function Select({ label, value, onChange, options, required = false }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; required?: boolean }) { return <label className="text-sm font-semibold">{label}{required && <span className="text-red-500"> *</span>}<select value={value} required={required} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="">Select</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function FileBox({ label, onChange }: { label: string; onChange: (file: File | null) => void }) { return <label className="rounded-xl border border-dashed p-5 text-sm font-semibold">{label}<input type="file" accept="image/*" onChange={(event) => onChange(event.target.files?.[0] ?? null)} className="mt-3 block w-full text-sm font-normal" /></label>; }
function Expiry({ label, status, expiry, setStatus, setExpiry }: { label: string; status: string; expiry: string; setStatus: (value: string) => void; setExpiry: (value: string) => void }) { return <div className="rounded-xl border bg-slate-50 p-4"><p className="font-semibold">{label}</p><select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-3 w-full rounded-lg border bg-white p-2"><option value="not_added">Not Added</option><option value="active">Active</option><option value="valid">Valid</option><option value="expiring_soon">Expiring Soon</option><option value="expired">Expired</option><option value="paid">Paid</option><option value="due">Due</option><option value="overdue">Overdue</option></select><input type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} className="mt-3 w-full rounded-lg border p-2" /></div>; }
