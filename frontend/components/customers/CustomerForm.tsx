'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createWorker } from 'tesseract.js';
import { Customer, customerApi } from '@/lib/customers';

type FormValues = {
  first_name: string;
  middle_name: string;
  last_name: string;
  mobile: string;
  alternate_mobile: string;
  whatsapp: string;
  email: string;
  date_of_birth: string;
  gender: string;
  aadhaar_number: string;
  pan_number: string;
  driving_licence_number: string;
  passport_number: string;
  voter_id: string;
  current_address: string;
  permanent_address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  occupation: string;
  company_name: string;
  gst_number: string;
  remarks: string;
  priority: string;
  status: string;
};

const emptyValues: FormValues = {
  first_name: '',
  middle_name: '',
  last_name: '',
  mobile: '',
  alternate_mobile: '',
  whatsapp: '',
  email: '',
  date_of_birth: '',
  gender: '',
  aadhaar_number: '',
  pan_number: '',
  driving_licence_number: '',
  passport_number: '',
  voter_id: '',
  current_address: '',
  permanent_address: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
  occupation: '',
  company_name: '',
  gst_number: '',
  remarks: '',
  priority: 'normal',
  status: 'active',
};

function customerToValues(customer?: Partial<Customer>): FormValues {
  if (!customer) return emptyValues;

  return {
    ...emptyValues,
    first_name: String(customer.first_name ?? ''),
    middle_name: String(customer.middle_name ?? ''),
    last_name: String(customer.last_name ?? ''),
    mobile: String(customer.mobile ?? ''),
    alternate_mobile: String(customer.alternate_mobile ?? ''),
    whatsapp: String(customer.whatsapp ?? ''),
    email: String(customer.email ?? ''),
    date_of_birth: String(customer.date_of_birth ?? ''),
    gender: String(customer.gender ?? ''),
    aadhaar_number: String(customer.aadhaar_number ?? ''),
    pan_number: String(customer.pan_number ?? ''),
    driving_licence_number: String(customer.driving_licence_number ?? ''),
    passport_number: String(customer.passport_number ?? ''),
    voter_id: String(customer.voter_id ?? ''),
    current_address: String(customer.current_address ?? ''),
    permanent_address: String(customer.permanent_address ?? ''),
    city: String(customer.city ?? ''),
    district: String(customer.district ?? ''),
    state: String(customer.state ?? ''),
    pincode: String(customer.pincode ?? ''),
    occupation: String(customer.occupation ?? ''),
    company_name: String(customer.company_name ?? ''),
    gst_number: String(customer.gst_number ?? ''),
    remarks: String(customer.remarks ?? ''),
    priority: String(customer.priority ?? 'normal'),
    status: String(customer.status ?? 'active'),
  };
}

function normaliseDate(value: string): string {
  const clean = value.trim().replace(/[.]/g, '/');
  const match = clean.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (!match) return '';
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function splitName(fullName: string) {
  const words = fullName
    .replace(/[^A-Za-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  if (!words.length) return {};
  if (words.length === 1) return { first_name: words[0] };
  if (words.length === 2) {
    return { first_name: words[0], last_name: words[1] };
  }

  return {
    first_name: words[0],
    middle_name: words.slice(1, -1).join(' '),
    last_name: words.at(-1) ?? '',
  };
}

function parseAadhaarText(text: string): Partial<FormValues> {
  const cleaned = text.replace(/\r/g, '\n');
  const lines = cleaned
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const result: Partial<FormValues> = {};

  const aadhaarMatch = cleaned.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
  if (aadhaarMatch) {
    result.aadhaar_number = aadhaarMatch[0].replace(/\s/g, '');
  }

  const dobLine = lines.find((line) => /dob|date of birth|year of birth|yob/i.test(line));
  if (dobLine) {
    const date = normaliseDate(dobLine);
    if (date) result.date_of_birth = date;
  }

  const genderText = cleaned.toLowerCase();
  if (/\bfemale\b/.test(genderText)) result.gender = 'female';
  else if (/\bmale\b/.test(genderText)) result.gender = 'male';
  else if (/\btransgender\b|\bother\b/.test(genderText)) result.gender = 'other';

  const probableName = lines.find((line) => {
    if (/government|india|aadhaar|dob|birth|male|female|address|vid|year/i.test(line)) return false;
    if (/\d/.test(line)) return false;
    const words = line.split(' ');
    return words.length >= 2 && words.length <= 5 && line.length <= 60;
  });

  if (probableName) Object.assign(result, splitName(probableName));

  const pincodeMatch = cleaned.match(/\b[1-9][0-9]{5}\b/);
  if (pincodeMatch) result.pincode = pincodeMatch[0];

  const addressIndex = lines.findIndex((line) => /address/i.test(line));
  if (addressIndex >= 0) {
    const addressLines = lines
      .slice(addressIndex + 1)
      .filter((line) => !/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(line))
      .filter((line) => !/^vid/i.test(line))
      .slice(0, 5);

    if (addressLines.length) {
      result.current_address = addressLines.join(', ');
      result.permanent_address = addressLines.join(', ');
    }
  }

  const stateNames = [
    'Gujarat', 'Rajasthan', 'Maharashtra', 'Madhya Pradesh', 'Uttar Pradesh',
    'Delhi', 'Punjab', 'Haryana', 'Karnataka', 'Tamil Nadu', 'Telangana',
    'Andhra Pradesh', 'Kerala', 'Bihar', 'West Bengal', 'Odisha', 'Assam',
    'Jharkhand', 'Chhattisgarh', 'Goa', 'Uttarakhand', 'Himachal Pradesh',
    'Jammu and Kashmir', 'Ladakh',
  ];

  const foundState = stateNames.find((state) =>
    cleaned.toLowerCase().includes(state.toLowerCase()),
  );
  if (foundState) result.state = foundState;

  const districtLine = lines.find((line) => /district|dist\.?/i.test(line));
  if (districtLine) {
    result.district = districtLine
      .replace(/district|dist\.?/gi, '')
      .replace(/[:,-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return result;
}

export function CustomerForm({ customer }: { customer?: Partial<Customer> }) {
  const router = useRouter();
  const [entryMode, setEntryMode] = useState<'aadhaar' | 'manual'>('manual');
  const [values, setValues] = useState<FormValues>(() => customerToValues(customer));
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [aadhaarFront, setAadhaarFront] = useState<File | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<File | null>(null);

  const frontPreview = useMemo(
    () => (aadhaarFront ? URL.createObjectURL(aadhaarFront) : ''),
    [aadhaarFront],
  );
  const backPreview = useMemo(
    () => (aadhaarBack ? URL.createObjectURL(aadhaarBack) : ''),
    [aadhaarBack],
  );

  function updateField(name: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function readAadhaar() {
    const files = [aadhaarFront, aadhaarBack].filter(Boolean) as File[];
    if (!files.length) {
      setError('Pehle Aadhaar front ya back image upload karo.');
      return;
    }

    setReading(true);
    setError('');
    setSuccess('');
    setOcrProgress(0);

    const worker = await createWorker('eng', 1, {
      logger: (message) => {
        if (message.status === 'recognizing text' && typeof message.progress === 'number') {
          setOcrProgress(Math.round(message.progress * 100));
        }
      },
    });

    try {
      let fullText = '';
      for (const file of files) {
        const result = await worker.recognize(file);
        fullText += `\n${result.data.text}`;
      }

      const extracted = parseAadhaarText(fullText);
      setValues((current) => ({ ...current, ...extracted }));
      setSuccess('Aadhaar details read ho gayi. Save se pehle sab details check aur edit kar lo.');
    } catch (readError) {
      console.error(readError);
      setError('Aadhaar clear read nahi hua. Manual entry se details bhar sakte ho.');
    } finally {
      await worker.terminate();
      setReading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const body = {
      ...values,
      tags: [],
      priority: values.priority || 'normal',
      status: values.status || 'active',
    };

    try {
      if (customer?.id) await customerApi.update(customer.id, body);
      else await customerApi.create(body);

      window.location.href = '/customers';
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Customer save nahi hua.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 px-6 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-200">Raj ERP</p>
          <h1 className="mt-2 text-2xl font-bold">{customer?.id ? 'Edit Customer' : 'Add New Customer'}</h1>
          <p className="mt-1 text-sm text-blue-100">Aadhaar se auto-fill karo ya saari details manually enter karo.</p>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setEntryMode('aadhaar')}
            className={`rounded-xl border p-4 text-left transition ${
              entryMode === 'aadhaar'
                ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100'
                : 'border-slate-200 hover:border-blue-300'
            }`}
          >
            <span className="block font-semibold text-slate-900">Aadhaar Auto Fill</span>
            <span className="mt-1 block text-sm text-slate-500">Front/back image upload karke free OCR se details read karein.</span>
          </button>

          <button
            type="button"
            onClick={() => setEntryMode('manual')}
            className={`rounded-xl border p-4 text-left transition ${
              entryMode === 'manual'
                ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100'
                : 'border-slate-200 hover:border-blue-300'
            }`}
          >
            <span className="block font-semibold text-slate-900">Manual Entry</span>
            <span className="mt-1 block text-sm text-slate-500">Aadhaar ke bina bhi poora customer manually add ho sakta hai.</span>
          </button>
        </div>
      </div>

      {entryMode === 'aadhaar' && (
        <Card title="Aadhaar Upload" subtitle="Clear JPG, PNG ya WEBP image use karein. Mobile aur email Aadhaar se read nahi honge.">
          <div className="grid gap-4 md:grid-cols-2">
            <UploadBox label="Aadhaar Front" preview={frontPreview} onChange={setAadhaarFront} />
            <UploadBox label="Aadhaar Back" preview={backPreview} onChange={setAadhaarBack} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={readAadhaar}
              disabled={reading}
              className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reading ? `Reading Aadhaar... ${ocrProgress}%` : 'Read Aadhaar Details'}
            </button>
            <p className="text-sm text-slate-500">OCR ke baad saare auto-filled fields editable rahenge.</p>
          </div>
        </Card>
      )}

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <Card title="Personal Information" subtitle="Required fields: first name, last name and mobile number.">
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="First Name" value={values.first_name} required onChange={(value) => updateField('first_name', value)} />
          <Input label="Middle Name" value={values.middle_name} onChange={(value) => updateField('middle_name', value)} />
          <Input label="Last Name" value={values.last_name} required onChange={(value) => updateField('last_name', value)} />
          <Input label="Mobile Number" value={values.mobile} required inputMode="tel" onChange={(value) => updateField('mobile', value)} />
          <Input label="Alternate Mobile" value={values.alternate_mobile} inputMode="tel" onChange={(value) => updateField('alternate_mobile', value)} />
          <Input label="WhatsApp Number" value={values.whatsapp} inputMode="tel" onChange={(value) => updateField('whatsapp', value)} />
          <Input label="Email" value={values.email} type="email" onChange={(value) => updateField('email', value)} />
          <Input label="Date of Birth" value={values.date_of_birth} type="date" onChange={(value) => updateField('date_of_birth', value)} />
          <Select
            label="Gender"
            value={values.gender}
            onChange={(value) => updateField('gender', value)}
            options={[
              ['', 'Select Gender'],
              ['male', 'Male'],
              ['female', 'Female'],
              ['other', 'Other'],
              ['prefer_not_to_say', 'Prefer Not To Say'],
            ]}
          />
        </div>
      </Card>

      <Card title="Identity Details" subtitle="Ye fields optional hain. Aadhaar number auto-fill ho sakta hai.">
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Aadhaar Number" value={values.aadhaar_number} inputMode="numeric" onChange={(value) => updateField('aadhaar_number', value.replace(/\D/g, '').slice(0, 12))} />
          <Input label="PAN Number" value={values.pan_number} onChange={(value) => updateField('pan_number', value.toUpperCase())} />
          <Input label="Driving Licence" value={values.driving_licence_number} onChange={(value) => updateField('driving_licence_number', value.toUpperCase())} />
          <Input label="Passport Number" value={values.passport_number} onChange={(value) => updateField('passport_number', value.toUpperCase())} />
          <Input label="Voter ID" value={values.voter_id} onChange={(value) => updateField('voter_id', value.toUpperCase())} />
          <Input label="GST Number" value={values.gst_number} onChange={(value) => updateField('gst_number', value.toUpperCase())} />
        </div>
      </Card>

      <Card title="Address" subtitle="OCR se address aaye to save se pehle spelling aur pincode verify karein.">
        <div className="grid gap-4 md:grid-cols-2">
          <Textarea label="Current Address" value={values.current_address} onChange={(value) => updateField('current_address', value)} />
          <Textarea label="Permanent Address" value={values.permanent_address} onChange={(value) => updateField('permanent_address', value)} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <Input label="City" value={values.city} onChange={(value) => updateField('city', value)} />
          <Input label="District" value={values.district} onChange={(value) => updateField('district', value)} />
          <Input label="State" value={values.state} onChange={(value) => updateField('state', value)} />
          <Input label="Pincode" value={values.pincode} inputMode="numeric" onChange={(value) => updateField('pincode', value.replace(/\D/g, '').slice(0, 6))} />
        </div>
      </Card>

      <Card title="Business & Notes" subtitle="Occupation aur company optional hain.">
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Occupation" value={values.occupation} onChange={(value) => updateField('occupation', value)} />
          <Input label="Company Name" value={values.company_name} onChange={(value) => updateField('company_name', value)} />
        </div>
        <div className="mt-4">
          <Textarea label="Remarks" value={values.remarks} onChange={(value) => updateField('remarks', value)} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Select
            label="Priority"
            value={values.priority}
            onChange={(value) => updateField('priority', value)}
            options={[
              ['low', 'Low'],
              ['normal', 'Normal'],
              ['high', 'High'],
              ['urgent', 'Urgent'],
            ]}
          />
          <Select
            label="Status"
            value={values.status}
            onChange={(value) => updateField('status', value)}
            options={[
              ['active', 'Active'],
              ['inactive', 'Inactive'],
              ['blocked', 'Blocked'],
            ]}
          />
        </div>
      </Card>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => router.push('/customers')}
          className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || reading}
          className="rounded-xl bg-blue-700 px-7 py-3 font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving Customer...' : customer?.id ? 'Update Customer' : 'Save Customer'}
        </button>
      </div>
    </form>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        required={required}
        inputMode={inputMode}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || 'empty'} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function UploadBox({
  label,
  preview,
  onChange,
}: {
  label: string;
  preview: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-blue-400 hover:bg-blue-50">
      <span className="block font-semibold text-slate-800">{label}</span>
      <span className="mt-1 block text-sm text-slate-500">Click karke clear Aadhaar image select karein.</span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={`${label} preview`} className="mt-4 h-44 w-full rounded-xl object-contain bg-white" />
      ) : (
        <div className="mt-4 flex h-32 items-center justify-center rounded-xl bg-white text-sm text-slate-400">No image selected</div>
      )}
    </label>
  );
}
