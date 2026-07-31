'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Customer, customerApi } from '@/lib/customers';
import { scanDocument } from '@/lib/ocr';
import { Vehicle, vehicleApi } from '@/lib/vehicles';
import { VehicleMaster, VehicleMasterType, vehicleMasterApi } from '@/lib/vehicle-masters';
type Values = Record<string, string>;
const initial: Values = {
    customer_id: '', vehicle_number: '', registration_date: '', registration_authority: '', state: 'Gujarat', district: '', vehicle_type: 'two_wheeler',
    vehicle_class: '', vehicle_category: '', manufacturer: '', model: '', variant: '', manufacturing_year: '', colour: '', fuel_type: '',
    seating_capacity: '', cubic_capacity: '', gross_weight: '', unladen_weight: '', chassis_number: '', engine_number: '', financier: '',
    insurance_status: 'not_added', fitness_status: 'not_added', permit_status: 'not_added', tax_status: 'not_added', puc_status: 'not_added',
    insurance_expiry: '', puc_expiry: '', fitness_expiry: '', permit_expiry: '', national_permit_expiry: '', tax_expiry: '', counter_tax_expiry: '', payment_due: '0',
};
const OCR_FIELDS = ['vehicle_number', 'registration_date', 'registration_authority', 'state', 'district', 'vehicle_type', 'vehicle_class', 'vehicle_category', 'manufacturer', 'model', 'variant', 'manufacturing_year', 'colour', 'fuel_type', 'seating_capacity', 'cubic_capacity', 'gross_weight', 'unladen_weight', 'chassis_number', 'engine_number', 'financier'];
function clean(v: string) { return v.replace(/[|{}<>©®]/g, ' ').replace(/\s+/g, ' ').replace(/^[:;,._\-\\/\s]+|[:;,._\-\\/\s]+$/g, '').trim(); }
function date(v: string) { const m = v.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; }
function nextValue(lines: string[], label: RegExp, max = 3) { for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i]))
        continue;
    const same = clean(lines[i].replace(label, ''));
    if (same && same.length > 1)
        return same;
    for (let j = 1; j <= max; j++) {
        const n = clean(lines[i + j] ?? '');
        if (n && !/regn|registration|chassis|engine|owner|fuel|address|vehicle class|maker|model|colour|body type|seating|unladen|cubic|financier|authority/i.test(n))
            return n;
    }
} return ''; }
function validText(v: string, min = 2, max = 60) { return v.length >= min && v.length <= max && /[A-Za-z0-9]/.test(v) && !/^name$|^type$|^number$|^no$/i.test(v); }
function parseRc(text: string): Partial<Values> {
    const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
    const joined = lines.join('\n');
    const out: Partial<Values> = {};
    const reg = joined.match(/\b[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4}\b/i);
    if (reg)
        out.vehicle_number = reg[0].replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const regLine = lines.find(l => /date of regn|date of registration|regn\.? date/i.test(l));
    const regDate = regLine ? (date(regLine) || date(lines[lines.indexOf(regLine) + 1] ?? '')) : '';
    if (regDate)
        out.registration_date = regDate;
    const chassis = nextValue(lines, /chassis\s*(?:no|number)?/i).replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (/^[A-Z0-9]{15,25}$/.test(chassis))
        out.chassis_number = chassis;
    const engine = nextValue(lines, /engine\s*\/\s*motor\s*(?:no|number)?|engine\s*(?:no|number)?/i).replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (/^[A-Z0-9]{8,25}$/.test(engine))
        out.engine_number = engine;
    const cls = nextValue(lines, /vehicle\s*class|class\s*of\s*vehicle/i);
    if (validText(cls, 4, 50) && /cycle|scooter|car|goods|taxi|passenger|lmv|hgv|lgv/i.test(cls))
        out.vehicle_class = cls.toUpperCase();
    const maker = nextValue(lines, /maker'?s?\s*name|manufacturer/i);
    if (validText(maker, 3, 50) && !/regn|number/i.test(maker))
        out.manufacturer = maker.toUpperCase();
    const model = nextValue(lines, /model\s*name|^model$/i);
    if (validText(model, 2, 50))
        out.model = model.toUpperCase();
    const colour = nextValue(lines, /colour|color/i);
    if (validText(colour, 3, 40) && !/body type/i.test(colour))
        out.colour = colour.toUpperCase();
    const body = nextValue(lines, /body\s*type/i);
    if (validText(body, 3, 50) && !/colour|color/i.test(body))
        out.vehicle_category = body.toUpperCase();
    const fuel = joined.match(/\b(PETROL|DIESEL|CNG|LPG|ELECTRIC|BATTERY|EV)\b/i);
    if (fuel)
        out.fuel_type = /electric|battery|ev/i.test(fuel[1]) ? 'electric' : fuel[1].toLowerCase();
    const seat = nextValue(lines, /seating\s*\(in\s*all\)\s*capacity|seating\s*capacity/i).match(/\b[1-9]\d?\b/)?.[0];
    if (seat && Number(seat) <= 100)
        out.seating_capacity = seat;
    const cc = nextValue(lines, /cubic\s*cap(?:acity)?(?:\s*\/.*)?/i).match(/\b\d{2,5}(?:\.\d{1,2})?\b/)?.[0];
    if (cc && Number(cc) >= 40)
        out.cubic_capacity = cc;
    const ulw = nextValue(lines, /unladen\s*weight/i).match(/\b\d{2,6}\b/)?.[0];
    if (ulw)
        out.unladen_weight = ulw;
    const gvw = nextValue(lines, /gross\s*(?:vehicle\s*)?weight/i).match(/\b\d{3,6}\b/)?.[0];
    if (gvw)
        out.gross_weight = gvw;
    const fin = nextValue(lines, /financier/i);
    if (validText(fin, 3, 60))
        out.financier = fin.toUpperCase();
    const auth = nextValue(lines, /registration\s*authority|registering\s*authority/i);
    if (validText(auth, 3, 40)) {
        out.registration_authority = auth.toUpperCase();
        out.district = auth.toUpperCase();
    }
    const my = lines.findIndex(l => /month[- ]?year\s*of\s*mfg/i.test(l));
    if (my >= 0) {
        const y = `${lines[my]} ${lines[my + 1] ?? ''}`.match(/(?:0?[1-9]|1[0-2])[-/](19\d{2}|20\d{2})/)?.[1];
        if (y)
            out.manufacturing_year = y;
    }
    const c = `${out.vehicle_class ?? ''} ${out.vehicle_category ?? ''}`.toLowerCase();
    if (/m-?cycle|motor\s*cycle|scooter|2wn|two\s*wheeler/.test(c))
        out.vehicle_type = 'two_wheeler';
    else if (/hgv|heavy\s*goods|truck|trailer/.test(c))
        out.vehicle_type = 'hgv';
    else if (/lgv|light\s*goods|pickup/.test(c))
        out.vehicle_type = 'lgv';
    else if (/taxi|cab|maxi|passenger/.test(c))
        out.vehicle_type = 'taxi';
    else if (/motor\s*car|private\s*car|lmv/.test(c))
        out.vehicle_type = 'private_car';
    return out;
}
async function imageParts(file: File): Promise<Blob[]> {
    const b = await createImageBitmap(file);
    const tall = b.height > b.width * 1.35;
    const ranges = tall ? [[0, 0.43], [0.43, 0.86]] : [[0, 1]];
    const parts: Blob[] = [];
    for (const [a, z] of ranges) {
        const sy = Math.round(b.height * a), sh = Math.round(b.height * (z - a));
        const scale = Math.max(1, Math.min(3.2, 2400 / b.width));
        const c = document.createElement('canvas');
        c.width = Math.round(b.width * scale);
        c.height = Math.round(sh * scale);
        const x = c.getContext('2d');
        if (!x)
            continue;
        x.drawImage(b, 0, sy, b.width, sh, 0, 0, c.width, c.height);
        const im = x.getImageData(0, 0, c.width, c.height);
        for (let i = 0; i < im.data.length; i += 4) {
            const g = im.data[i] * .299 + im.data[i + 1] * .587 + im.data[i + 2] * .114;
            const v = g > 200 ? 255 : g < 70 ? 0 : Math.round((g - 70) * 1.96);
            im.data[i] = v;
            im.data[i + 1] = v;
            im.data[i + 2] = v;
        }
        x.putImageData(im, 0, 0);
        parts.push(await new Promise(r => c.toBlob(q => r(q ?? file), 'image/png', 1)));
    }
    return parts;
}
export function VehicleForm({ vehicle }: {
    vehicle?: Partial<Vehicle>;
}) {
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
    const [masters, setMasters] = useState<Record<VehicleMasterType, VehicleMaster[]>>({ manufacturers: [], models: [], colours: [], vehicle_classes: [], body_types: [], fuel_types: [] });
    const [masterModal, setMasterModal] = useState<VehicleMasterType>();
    const [masterSaving, setMasterSaving] = useState(false);
    useEffect(() => { customerApi.list('?per_page=500').then(r => setCustomers(r.data ?? [])).catch(e => setError(e instanceof Error ? e.message : 'Customers load nahi hue.')); }, []);
    useEffect(() => { void loadMasters(); }, []);
    useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape' && !masterSaving) setMasterModal(undefined); }; addEventListener('keydown', close); return () => removeEventListener('keydown', close); }, [masterSaving]);
    const set = (n: string, v: string) => setValues(o => ({ ...o, [n]: v }));
    async function loadMasters() {
        const types: VehicleMasterType[] = ['manufacturers', 'models', 'colours', 'vehicle_classes', 'body_types', 'fuel_types'];
        const lists = await Promise.all(types.map(type => vehicleMasterApi.list(type)));
        setMasters(Object.fromEntries(types.map((type, index) => [type, lists[index]])) as Record<VehicleMasterType, VehicleMaster[]>);
    }
    async function addMaster(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!masterModal || masterSaving) return;
        setMasterSaving(true); setError('');
        const fd = new FormData(e.currentTarget);
        try {
            const parent = masters.manufacturers.find(x => x.name === values.manufacturer);
            const created = await vehicleMasterApi.create(masterModal, { name: fd.get('name'), code: fd.get('code'), parent_id: masterModal === 'models' ? parent?.id : null, status: 'active' });
            await loadMasters();
            const field:Record<VehicleMasterType,string>={manufacturers:'manufacturer',models:'model',colours:'colour',vehicle_classes:'vehicle_class',body_types:'vehicle_category',fuel_types:'fuel_type'};
            set(field[masterModal], created.name);
            if (masterModal === 'manufacturers') set('model', '');
            setMasterModal(undefined); setSuccess(`${created.name} added and selected.`);
        } catch (e) { setError(e instanceof Error ? e.message : 'Master could not be saved.'); }
        finally { setMasterSaving(false); }
    }
    async function readRc() { if (!front && !back) {
        setError('Pehle RC image upload karo.');
        return;
    } setReading(true); setProgress(20); setError(''); setSuccess(''); try {
        const files = [front, back].filter(Boolean) as File[];
        const unique = files.filter((f, i, a) => a.findIndex(x => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified) === i);
        const extracted = (await scanDocument('rc', unique)).fields;
        setProgress(100);
        setValues(old => { const cleared = { ...old }; for (const k of OCR_FIELDS)
            cleared[k] = ''; return { ...cleared, ...extracted, customer_id: old.customer_id, state: extracted.state || old.state || 'Gujarat' }; });
        const count = Object.keys(extracted).length;
        setSuccess(count ? `RC se ${count} details fill hui. Save se pehle verify kar lena.` : 'RC se reliable detail nahi mili. Manual entry use karo.');
    }
    catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : 'RC clear read nahi hui. Manual entry available hai.');
    }
    finally {
        setReading(false);
    } }
    async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setSaving(true); setError(''); try {
        const body = { ...values, hypothecation: Boolean(values.financier), manufacturing_year: values.manufacturing_year ? Number(values.manufacturing_year) : null, seating_capacity: values.seating_capacity ? Number(values.seating_capacity) : null, cubic_capacity: values.cubic_capacity ? Number(values.cubic_capacity) : null, gross_weight: values.gross_weight ? Number(values.gross_weight) : null, unladen_weight: values.unladen_weight ? Number(values.unladen_weight) : null, payment_due: Number(values.payment_due || 0) };
        const saved = vehicle?.id ? await vehicleApi.update(vehicle.id, body) : await vehicleApi.create(body);
        router.push(`/vehicles/${saved.id}`);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Vehicle save nahi hua.');
    }
    finally {
        setSaving(false);
    } }
    const commercial = ['lgv', 'hgv', 'taxi'].includes(values.vehicle_type), hgv = values.vehicle_type === 'hgv', taxi = values.vehicle_type === 'taxi';
    return <><form onSubmit={submit} className="space-y-6 pb-24">
<section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
<div className="bg-gradient-to-r from-slate-950 to-blue-800 p-6 text-white">
<h1 className="text-2xl font-bold">{vehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h1>
<p className="mt-1 text-blue-100">Customer manually select hoga. RC OCR sirf vehicle details fill karega.</p>
</div>
<div className="grid gap-3 p-5 md:grid-cols-2">
<Mode active={mode === 'rc'} title="RC Book Upload" text="Front/back ya combined RC image upload karo." onClick={() => setMode('rc')}/>
<Mode active={mode === 'manual'} title="Manual Entry" text="Saari details manually bhar sakte ho." onClick={() => setMode('manual')}/>
</div>{mode === 'rc' && <div className="grid gap-4 border-t p-5 md:grid-cols-2">
<FileBox label="RC Front / Combined Image" onChange={setFront}/>
<FileBox label="RC Back (optional)" onChange={setBack}/>
<button type="button" onClick={readRc} disabled={reading} className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white md:col-span-2">{reading ? `Reading RC... ${progress}%` : 'Read RC Details'}</button>
</div>}</section>{error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}{success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{success}</div>}<Card title="Owner & Basic Details">
<Select label="Customer" value={values.customer_id} onChange={v => set('customer_id', v)} required options={customers.map(c => ({ value: c.id, label: `${c.first_name} ${c.middle_name ?? ''} ${c.last_name} — ${c.mobile}` }))}/>
<Input label="Vehicle Number" value={values.vehicle_number} onChange={v => set('vehicle_number', v.toUpperCase())} required/>
<Input label="Registration Date" type="date" value={values.registration_date} onChange={v => set('registration_date', v)}/>
<Input label="Registration Authority" value={values.registration_authority} onChange={v => set('registration_authority', v)}/>
<Input label="State" value={values.state} onChange={v => set('state', v)}/>
<Input label="District" value={values.district} onChange={v => set('district', v)}/>
<Select label="Vehicle Type" value={values.vehicle_type} onChange={v => set('vehicle_type', v)} options={[{ value: 'two_wheeler', label: 'Motorcycle / Scooter' }, { value: 'private_car', label: 'Private Car' }, { value: 'lgv', label: 'LGV / Pickup' }, { value: 'hgv', label: 'HGV / GT' }, { value: 'taxi', label: 'Taxi' }]}/>
</Card>
<Card title="Vehicle Details">
<MasterSelect label="Vehicle Class" value={values.vehicle_class} onChange={v => set('vehicle_class', v)} options={masters.vehicle_classes.filter(x => x.status === 'active').map(x => x.name)} add={() => setMasterModal('vehicle_classes')}/>
<MasterSelect label="Vehicle Category / Body Type" value={values.vehicle_category} onChange={v => set('vehicle_category', v)} options={masters.body_types.filter(x => x.status === 'active').map(x => x.name)} add={() => setMasterModal('body_types')}/>
<MasterSelect label="Manufacturer" value={values.manufacturer} onChange={v => { set('manufacturer', v); set('model', ''); }} options={masters.manufacturers.filter(x => x.status === 'active').map(x => x.name)} add={() => setMasterModal('manufacturers')}/>
<MasterSelect label="Model" value={values.model} onChange={v => set('model', v)} options={masters.models.filter(x => x.status === 'active' && (!values.manufacturer || x.parent_name === values.manufacturer)).map(x => x.name)} add={() => values.manufacturer ? setMasterModal('models') : setError('Select a manufacturer before adding a model.')}/>
<Input label="Variant" value={values.variant} onChange={v => set('variant', v)}/>
<Input label="Manufacturing Year" type="number" value={values.manufacturing_year} onChange={v => set('manufacturing_year', v)}/>
<MasterSelect label="Colour" value={values.colour} onChange={v => set('colour', v)} options={masters.colours.filter(x => x.status === 'active').map(x => x.name)} add={() => setMasterModal('colours')}/>
<MasterSelect label="Fuel Type" value={values.fuel_type} onChange={v => set('fuel_type', v)} options={masters.fuel_types.filter(x => x.status === 'active').map(x => x.name)} add={() => setMasterModal('fuel_types')}/>
<Input label="Seating Capacity" type="number" value={values.seating_capacity} onChange={v => set('seating_capacity', v)}/>
<Input label="Cubic Capacity" type="number" value={values.cubic_capacity} onChange={v => set('cubic_capacity', v)}/>{commercial && <>
<Input label="Gross Weight" type="number" value={values.gross_weight} onChange={v => set('gross_weight', v)}/>
<Input label="Unladen Weight" type="number" value={values.unladen_weight} onChange={v => set('unladen_weight', v)}/>
</>}</Card>
<Card title="Identification & Finance">
<Input label="Chassis Number" value={values.chassis_number} onChange={v => set('chassis_number', v.toUpperCase())} required/>
<Input label="Engine Number" value={values.engine_number} onChange={v => set('engine_number', v.toUpperCase())} required/>
<Input label="Financier / Hypothecation" value={values.financier} onChange={v => set('financier', v)}/>
<Input label="Payment Due" type="number" value={values.payment_due} onChange={v => set('payment_due', v)}/>
</Card>
<Card title="Compliance & Expiry">
<Expiry label="Insurance" status={values.insurance_status} expiry={values.insurance_expiry} setStatus={v => set('insurance_status', v)} setExpiry={v => set('insurance_expiry', v)}/>
<Expiry label="PUC" status={values.puc_status} expiry={values.puc_expiry} setStatus={v => set('puc_status', v)} setExpiry={v => set('puc_expiry', v)}/>{commercial && <Expiry label="Fitness" status={values.fitness_status} expiry={values.fitness_expiry} setStatus={v => set('fitness_status', v)} setExpiry={v => set('fitness_expiry', v)}/>} {(hgv || taxi) && <>
<Expiry label="Permit" status={values.permit_status} expiry={values.permit_expiry} setStatus={v => set('permit_status', v)} setExpiry={v => set('permit_expiry', v)}/>
<Expiry label="National Permit" status={values.permit_status} expiry={values.national_permit_expiry} setStatus={v => set('permit_status', v)} setExpiry={v => set('national_permit_expiry', v)}/>
</>}{hgv && <>
<Expiry label="Tax" status={values.tax_status} expiry={values.tax_expiry} setStatus={v => set('tax_status', v)} setExpiry={v => set('tax_expiry', v)}/>
<Expiry label="Counter Tax" status={values.tax_status} expiry={values.counter_tax_expiry} setStatus={v => set('tax_status', v)} setExpiry={v => set('counter_tax_expiry', v)}/>
</>}</Card>
<div className="fixed bottom-0 left-0 right-0 z-20 flex justify-end border-t bg-white/95 p-4 backdrop-blur lg:left-[260px]">
<button disabled={saving} className="rounded-xl bg-blue-700 px-7 py-3 font-semibold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save Vehicle'}</button>
</div>
</form>{masterModal && <MasterModal type={masterModal} saving={masterSaving} close={() => setMasterModal(undefined)} save={addMaster} manufacturer={values.manufacturer}/>}</>;
}
function Mode({ active, title, text, onClick }: {
    active: boolean;
    title: string;
    text: string;
    onClick: () => void;
}) { return <button type="button" onClick={onClick} className={`rounded-xl border p-4 text-left ${active ? 'border-blue-600 bg-blue-50' : 'bg-white'}`}>
<b>{title}</b>
<p className="text-sm text-slate-500">{text}</p>
</button>; }
function Card({ title, children }: {
    title: string;
    children: React.ReactNode;
}) { return <section className="rounded-2xl border bg-white p-5 shadow-sm">
<h2 className="mb-4 text-lg font-bold">{title}</h2>
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
</section>; }
function Input({ label, value, onChange, type = 'text', required = false }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    required?: boolean;
}) { return <label className="text-sm font-semibold">{label}{required && <span className="text-red-500"> *</span>}<input type={type} value={value} required={required} onChange={e => onChange(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
</label>; }
function Select({ label, value, onChange, options, required = false }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: {
        value: string;
        label: string;
    }[];
    required?: boolean;
}) { return <label className="text-sm font-semibold">{label}{required && <span className="text-red-500"> *</span>}<select value={value} required={required} onChange={e => onChange(e.target.value)} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal">
<option value="">Select</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
</label>; }
function MasterSelect({ label, value, onChange, options, add }: { label: string; value: string; onChange: (v: string) => void; options: string[]; add: () => void }) {
    return <div><label className="text-sm font-semibold">{label}<select value={value} onChange={e => onChange(e.target.value)} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="">Select</option>{value && !options.includes(value) && <option value={value}>{value} (existing)</option>}{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label><button type="button" onClick={add} className="mt-2 text-sm font-bold text-blue-700">+ Add {label}</button></div>;
}
function MasterModal({ type, saving, close, save, manufacturer }: { type: VehicleMasterType; saving: boolean; close: () => void; save: (e: FormEvent<HTMLFormElement>) => void; manufacturer: string }) {
    const labels:Record<VehicleMasterType,string>={manufacturers:'Manufacturer',models:'Vehicle Model',colours:'Vehicle Colour',vehicle_classes:'Vehicle Class',body_types:'Body Type',fuel_types:'Fuel Type'};
    const label=labels[type];
    return <div onMouseDown={e => { if (e.target === e.currentTarget && !saving) close(); }} className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4"><section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex justify-between"><h2 className="text-xl font-black">Add {label}</h2><button type="button" disabled={saving} onClick={close}>✕</button></div>{type === 'models' && <p className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">Manufacturer: <strong>{manufacturer}</strong></p>}<form onSubmit={save} className="space-y-4"><label className="block text-sm font-semibold">Name<input name="name" required autoFocus className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"/></label><label className="block text-sm font-semibold">Code<input name="code" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"/></label><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={close} className="rounded-xl border px-5 py-3">Cancel</button><button disabled={saving} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">{saving ? 'Saving…' : `Save ${label}`}</button></div></form></section></div>;
}
function FileBox({ label, onChange }: {
    label: string;
    onChange: (f: File | null) => void;
}) { return <label className="rounded-xl border border-dashed p-5 text-sm font-semibold">{label}<input type="file" accept="image/*" onChange={e => onChange(e.target.files?.[0] ?? null)} className="mt-3 block w-full text-sm font-normal"/>
</label>; }
function Expiry({ label, status, expiry, setStatus, setExpiry }: {
    label: string;
    status: string;
    expiry: string;
    setStatus: (v: string) => void;
    setExpiry: (v: string) => void;
}) { return <div className="rounded-xl border bg-slate-50 p-4">
<p className="font-semibold">{label}</p>
<select value={status} onChange={e => setStatus(e.target.value)} className="mt-3 w-full rounded-lg border bg-white p-2">
<option value="not_added">Not Added</option>
<option value="active">Active</option>
<option value="valid">Valid</option>
<option value="expiring_soon">Expiring Soon</option>
<option value="expired">Expired</option>
<option value="paid">Paid</option>
<option value="due">Due</option>
<option value="overdue">Overdue</option>
</select>
<input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className="mt-3 w-full rounded-lg border p-2"/>
</div>; }
