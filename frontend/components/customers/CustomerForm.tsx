'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Customer, customerApi } from '@/lib/customers';
import { scanDocument } from '@/lib/ocr';

type FormValues = {
  first_name: string; middle_name: string; last_name: string;
  mobile: string; alternate_mobile: string; whatsapp: string; email: string;
  date_of_birth: string; gender: string; aadhaar_number: string;
  pan_number: string; driving_licence_number: string; passport_number: string; voter_id: string;
  current_address: string; permanent_address: string; city: string; district: string; state: string; pincode: string;
  occupation: string; company_name: string; gst_number: string; remarks: string;
  priority: string; status: string;
};

const blank: FormValues = {
  first_name: '', middle_name: '', last_name: '', mobile: '', alternate_mobile: '', whatsapp: '', email: '',
  date_of_birth: '', gender: '', aadhaar_number: '', pan_number: '', driving_licence_number: '', passport_number: '', voter_id: '',
  current_address: '', permanent_address: '', city: '', district: '', state: '', pincode: '', occupation: '', company_name: '',
  gst_number: '', remarks: '', priority: 'normal', status: 'active',
};

function initialValues(customer?: Partial<Customer>): FormValues {
  if (!customer) return blank;
  const out = { ...blank } as Record<string, string>;
  Object.keys(out).forEach((key) => {
    const value = (customer as Record<string, unknown>)[key];
    if (value !== undefined && value !== null) out[key] = String(value);
  });
  return out as FormValues;
}

function cleanLine(line: string) {
  return line.replace(/[|_[\]{}<>~`^*=]+/g, ' ').replace(/[^A-Za-z0-9À-ž\s,./:-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function normaliseDate(value: string) {
  const match = value.replace(/[.]/g, '/').match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (!match) return '';
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function splitName(value: string): Partial<FormValues> {
  const words = value.replace(/[^A-Za-z\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter((word) => word.length > 1).map(titleCase);
  if (!words.length) return {};
  if (words.length === 1) return { first_name: words[0] };
  if (words.length === 2) return { first_name: words[0], last_name: words[1] };
  return { first_name: words[0], middle_name: words.slice(1, -1).join(' '), last_name: words.at(-1) ?? '' };
}

function findName(lines: string[]) {
  const blocked = /government|india|aadhaar|uidai|dob|birth|male|female|address|vid|download|issue|year|father|mother|husband|enrol/i;
  const markerIndex = lines.findIndex((line) => /dob|date of birth|yob|year of birth|\bmale\b|\bfemale\b/i.test(line));
  const candidates = (markerIndex > 0 ? lines.slice(Math.max(0, markerIndex - 4), markerIndex) : lines)
    .filter((line) => !blocked.test(line))
    .filter((line) => !/\d/.test(line))
    .filter((line) => /^[A-Za-z][A-Za-z .'-]{3,55}$/.test(line))
    .filter((line) => {
      const words = line.split(/\s+/);
      return words.length >= 2 && words.length <= 5 && words.every((word) => word.length >= 2);
    });
  return candidates.at(-1) ?? '';
}

function parseAadhaarText(frontText: string, backText: string): Partial<FormValues> {
  const allText = `${frontText}\n${backText}`;
  const frontLines = frontText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const result: Partial<FormValues> = {};
  const aadhaar = allText.match(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/);
  if (aadhaar) result.aadhaar_number = aadhaar[0].replace(/\D/g, '');
  const dobLine = frontLines.find((line) => /dob|date of birth/i.test(line));
  if (dobLine) result.date_of_birth = normaliseDate(dobLine);
  const lower = frontText.toLowerCase();
  if (/\bfemale\b/.test(lower)) result.gender = 'female';
  else if (/\bmale\b/.test(lower)) result.gender = 'male';
  else if (/\btransgender\b/.test(lower)) result.gender = 'other';
  const name = findName(frontLines);
  if (name) Object.assign(result, splitName(name));
  const pins = [...allText.matchAll(/\b[1-9][0-9]{5}\b/g)].map((match) => match[0]);
  if (pins.length) result.pincode = pins.at(-1);
  result.current_address = '';
  result.permanent_address = '';
  return result;
}

async function lookupPincode(pincode: string): Promise<Partial<FormValues>> {
  if (!/^\d{6}$/.test(pincode)) return {};
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    if (!response.ok) return {};
    const json = await response.json();
    const offices = json?.[0]?.PostOffice;
    if (!Array.isArray(offices) || !offices.length) return {};
    const office = offices[0];
    return { city: String(office.Block || office.Name || '').trim(), district: String(office.District || '').trim(), state: String(office.State || '').trim() };
  } catch { return {}; }
}

export function CustomerForm({ customer }: { customer?: Partial<Customer> }) {
  const router = useRouter();
  const [entryMode, setEntryMode] = useState<'aadhaar' | 'manual'>('manual');
  const [values, setValues] = useState<FormValues>(() => initialValues(customer));
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const frontPreview = useMemo(() => (front ? URL.createObjectURL(front) : ''), [front]);
  const backPreview = useMemo(() => (back ? URL.createObjectURL(back) : ''), [back]);

  useEffect(() => () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);
  }, [frontPreview, backPreview]);

  function setField(name: keyof FormValues, value: string) {
    setValues((old) => ({ ...old, [name]: value }));
  }

  async function handlePincode(value: string) {
    const pin = value.replace(/\D/g, '').slice(0, 6);
    setField('pincode', pin);
    if (pin.length === 6) {
      const location = await lookupPincode(pin);
      setValues((old) => ({ ...old, ...location, pincode: pin }));
    }
  }

  async function readAadhaar() {
    if (!front && !back) { setError('Pehle Aadhaar front ya back image upload karo.'); return; }
    setReading(true); setError(''); setSuccess(''); setProgress(20);
    try {
      const files = [front, back].filter(Boolean) as File[];
      const { texts } = await scanDocument('aadhaar', files);
      setProgress(100);
      const [frontText = '', backText = ''] = texts;
      const extracted = parseAadhaarText(frontText, backText);
      const location = extracted.pincode ? await lookupPincode(extracted.pincode) : {};
      setValues((old) => ({ ...old, ...extracted, ...location }));
      setSuccess('Details fill ho gayi. Name, DOB aur pincode save se pehle check kar lena.');
    } catch (err) {
      console.error(err); setError('Aadhaar clear read nahi hua. Manual Entry se details bhar sakte ho.');
    } finally { setReading(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const body = { ...values, tags: [], priority: values.priority || 'normal', status: values.status || 'active' };
      if (customer?.id) await customerApi.update(customer.id, body); else await customerApi.create(body);
      window.location.href = '/customers';
    } catch (err) { setError(err instanceof Error ? err.message : 'Customer save nahi hua.'); }
    finally { setSaving(false); }
  }

  return <form onSubmit={submit} className="space-y-6">
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 px-6 py-6 text-white"><p className="text-xs font-semibold uppercase tracking-[.25em] text-blue-200">Raj ERP</p><h1 className="mt-2 text-2xl font-bold">{customer?.id ? 'Edit Customer' : 'Add New Customer'}</h1><p className="mt-1 text-sm text-blue-100">Aadhaar auto-fill ya manual entry—dono available hain.</p></div>
      <div className="grid gap-3 p-5 sm:grid-cols-2"><Mode active={entryMode === 'aadhaar'} title="Aadhaar Auto Fill" text="Front/back upload karke free OCR se details bharo." onClick={() => setEntryMode('aadhaar')} /><Mode active={entryMode === 'manual'} title="Manual Entry" text="Aadhaar ke bina saari details manually bharo." onClick={() => setEntryMode('manual')} /></div>
    </div>
    {entryMode === 'aadhaar' && <Card title="Aadhaar Upload" subtitle="Address se sirf City, District, State aur Pincode auto-fill hoga."><div className="grid gap-4 md:grid-cols-2"><Upload label="Aadhaar Front" preview={frontPreview} onChange={setFront} /><Upload label="Aadhaar Back" preview={backPreview} onChange={setBack} /></div><button type="button" onClick={readAadhaar} disabled={reading} className="mt-4 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-60">{reading ? `Reading... ${progress}%` : 'Read Aadhaar Details'}</button></Card>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}{success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{success}</div>}
    <Card title="Personal Information" subtitle="First name, last name aur mobile required hain."><Grid><Input label="First Name" value={values.first_name} required onChange={(v) => setField('first_name', v)} /><Input label="Middle Name" value={values.middle_name} onChange={(v) => setField('middle_name', v)} /><Input label="Last Name / Surname" value={values.last_name} required onChange={(v) => setField('last_name', v)} /><Input label="Mobile Number" value={values.mobile} required onChange={(v) => setField('mobile', v)} /><Input label="Alternate Mobile" value={values.alternate_mobile} onChange={(v) => setField('alternate_mobile', v)} /><Input label="WhatsApp" value={values.whatsapp} onChange={(v) => setField('whatsapp', v)} /><Input label="Email" type="email" value={values.email} onChange={(v) => setField('email', v)} /><Input label="Date of Birth" type="date" value={values.date_of_birth} onChange={(v) => setField('date_of_birth', v)} /><Select label="Gender" value={values.gender} onChange={(v) => setField('gender', v)} options={[['','Select Gender'],['male','Male'],['female','Female'],['other','Other'],['prefer_not_to_say','Prefer Not To Say']]} /></Grid></Card>
    <Card title="Identity Details" subtitle="Optional identity numbers."><Grid><Input label="Aadhaar Number" value={values.aadhaar_number} onChange={(v) => setField('aadhaar_number', v.replace(/\D/g, '').slice(0, 12))} /><Input label="PAN Number" value={values.pan_number} onChange={(v) => setField('pan_number', v.toUpperCase())} /><Input label="Driving Licence" value={values.driving_licence_number} onChange={(v) => setField('driving_licence_number', v.toUpperCase())} /><Input label="Passport Number" value={values.passport_number} onChange={(v) => setField('passport_number', v.toUpperCase())} /><Input label="Voter ID" value={values.voter_id} onChange={(v) => setField('voter_id', v.toUpperCase())} /><Input label="GST Number" value={values.gst_number} onChange={(v) => setField('gst_number', v.toUpperCase())} /></Grid></Card>
    <Card title="Address" subtitle="Full address manual rahega; location pincode se auto-fill hogi."><div className="grid gap-4 md:grid-cols-2"><Textarea label="Current Address" value={values.current_address} onChange={(v) => setField('current_address', v)} /><Textarea label="Permanent Address" value={values.permanent_address} onChange={(v) => setField('permanent_address', v)} /></div><div className="mt-4 grid gap-4 md:grid-cols-4"><Input label="City" value={values.city} onChange={(v) => setField('city', v)} /><Input label="District" value={values.district} onChange={(v) => setField('district', v)} /><Input label="State" value={values.state} onChange={(v) => setField('state', v)} /><Input label="Pincode" value={values.pincode} onChange={(v) => { void handlePincode(v); }} /></div></Card>
    <Card title="Business & Notes" subtitle="Optional information."><Grid><Input label="Occupation" value={values.occupation} onChange={(v) => setField('occupation', v)} /><Input label="Company Name" value={values.company_name} onChange={(v) => setField('company_name', v)} /><Select label="Priority" value={values.priority} onChange={(v) => setField('priority', v)} options={[['low','Low'],['normal','Normal'],['high','High'],['urgent','Urgent']]} /><Select label="Status" value={values.status} onChange={(v) => setField('status', v)} options={[['active','Active'],['inactive','Inactive'],['blocked','Blocked']]} /></Grid><div className="mt-4"><Textarea label="Remarks" value={values.remarks} onChange={(v) => setField('remarks', v)} /></div></Card>
    <div className="sticky bottom-4 flex justify-between rounded-2xl border bg-white/95 p-4 shadow-lg backdrop-blur"><button type="button" onClick={() => router.push('/customers')} className="rounded-xl border px-5 py-3 font-semibold">Cancel</button><button disabled={saving || reading} className="rounded-xl bg-blue-700 px-7 py-3 font-semibold text-white disabled:opacity-60">{saving ? 'Saving...' : customer?.id ? 'Update Customer' : 'Save Customer'}</button></div>
  </form>;
}

function Mode({ active, title, text, onClick }: { active: boolean; title: string; text: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-xl border p-4 text-left ${active ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200'}`}><b>{title}</b><span className="mt-1 block text-sm text-slate-500">{text}</span></button>; }
function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="mb-5 border-b pb-4"><h2 className="text-lg font-bold">{title}</h2><p className="text-sm text-slate-500">{subtitle}</p></div>{children}</section>; }
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid gap-4 md:grid-cols-3">{children}</div>; }
function Input({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) { return <label className="text-sm font-semibold text-slate-700">{label}{required && <span className="text-red-500"> *</span>}<input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" /></label>; }
function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <label className="text-sm font-semibold text-slate-700">{label}<textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string,string][] }) { return <label className="text-sm font-semibold text-slate-700">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal">{options.map(([v,l]) => <option key={v || 'empty'} value={v}>{l}</option>)}</select></label>; }
function Upload({ label, preview, onChange }: { label: string; preview: string; onChange: (file: File | null) => void }) { return <label className="block cursor-pointer rounded-2xl border-2 border-dashed bg-slate-50 p-4"><b>{label}</b><span className="block text-sm text-slate-500">Clear image select karein</span><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />{preview ? <img src={preview} alt={label} className="mt-4 h-44 w-full rounded-xl bg-white object-contain" /> : <div className="mt-4 flex h-32 items-center justify-center rounded-xl bg-white text-slate-400">No image selected</div>}</label>; }
