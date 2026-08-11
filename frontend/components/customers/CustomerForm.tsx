"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Customer, customerApi } from "@/lib/customers";
import { BRAND } from "@/config/brand";

type FormValues = {
  first_name: string;
  middle_name: string;
  last_name: string;
  mobile: string;
  whatsapp: string;
  email: string;
  date_of_birth: string;
  gender: string;
  current_address: string;
  permanent_address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
};

const blank: FormValues = {
  first_name: "",
  middle_name: "",
  last_name: "",
  mobile: "",
  whatsapp: "",
  email: "",
  date_of_birth: "",
  gender: "",
  current_address: "",
  permanent_address: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
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

async function lookupPincode(pincode: string): Promise<Partial<FormValues>> {
  if (!/^\d{6}$/.test(pincode)) return {};
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    if (!response.ok) return {};
    const json = await response.json();
    const offices = json?.[0]?.PostOffice;
    if (!Array.isArray(offices) || !offices.length) return {};
    const office = offices[0];
    return {
      city: String(office.Block || office.Name || "").trim(),
      district: String(office.District || "").trim(),
      state: String(office.State || "").trim(),
    };
  } catch {
    return {};
  }
}

export function CustomerForm({ customer }: { customer?: Partial<Customer> }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => initialValues(customer));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(name: keyof FormValues, value: string) {
    setValues((old) => ({ ...old, [name]: value }));
  }

  async function handlePincode(value: string) {
    const pin = value.replace(/\D/g, "").slice(0, 6);
    setField("pincode", pin);
    if (pin.length === 6) {
      const location = await lookupPincode(pin);
      setValues((old) => ({ ...old, ...location, pincode: pin }));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { ...values, tags: [], priority: "normal", status: "active" };
      if (customer?.id) await customerApi.update(customer.id, body);
      else await customerApi.create(body);
      window.location.href = "/customers";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Customer save nahi hua.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-[1500px] space-y-5 pb-28">
      <section className="relative overflow-hidden rounded-[30px] border border-[#153d79] bg-[#071a3c] p-6 text-white shadow-[0_24px_70px_rgba(7,26,60,.22)] sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(49,124,255,.5),transparent_32%),linear-gradient(135deg,#06152f,#0a2555_58%,#0d3b87)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#63d4ff]">{BRAND.brandName} · Customer</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">{customer?.id ? "Edit Customer" : "Add Customer"}</h1>
            <p className="mt-2 max-w-xl text-sm text-blue-100/75">Only essential customer details. Fast entry, no unnecessary fields.</p>
          </div>
          <button type="button" onClick={() => router.push("/customers")} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black backdrop-blur">← Customer CRM</button>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

      <Section no="01" eyebrow="Customer identity" title="Personal Information" subtitle="Primary contact details used across the ERP.">
        <Grid>
          <Input label="First Name" value={values.first_name} required onChange={(v) => setField("first_name", v)} />
          <Input label="Middle Name" value={values.middle_name} onChange={(v) => setField("middle_name", v)} />
          <Input label="Last Name / Surname" value={values.last_name} required onChange={(v) => setField("last_name", v)} />
          <Input label="Mobile Number" value={values.mobile} required onChange={(v) => setField("mobile", v.replace(/\D/g, "").slice(0, 10))} />
          <Input label="WhatsApp" value={values.whatsapp} onChange={(v) => setField("whatsapp", v.replace(/\D/g, "").slice(0, 10))} />
          <Input label="Email" type="email" value={values.email} onChange={(v) => setField("email", v)} />
          <Input label="Date of Birth" type="date" value={values.date_of_birth} onChange={(v) => setField("date_of_birth", v)} />
          <Select label="Gender" value={values.gender} onChange={(v) => setField("gender", v)} options={[["", "Select Gender"], ["male", "Male"], ["female", "Female"], ["other", "Other"]]} />
        </Grid>
      </Section>

      <Section no="02" eyebrow="Location" title="Address" subtitle="Pincode auto-fills city, district and state where available.">
        <div className="grid gap-4 md:grid-cols-2">
          <Textarea label="Current Address" value={values.current_address} onChange={(v) => setField("current_address", v)} />
          <Textarea label="Permanent Address" value={values.permanent_address} onChange={(v) => setField("permanent_address", v)} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="City" value={values.city} onChange={(v) => setField("city", v)} />
          <Input label="District" value={values.district} onChange={(v) => setField("district", v)} />
          <Input label="State" value={values.state} onChange={(v) => setField("state", v)} />
          <Input label="Pincode" value={values.pincode} onChange={(v) => void handlePincode(v)} />
        </div>
      </Section>

      <div className="flex flex-col gap-3 rounded-[24px] border border-[#dbe5f2] bg-white p-4 shadow-[0_12px_35px_rgba(7,26,60,.08)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><p className="text-[9px] font-black uppercase tracking-[.16em] text-blue-500">Save customer</p><p className="mt-1 text-xs font-semibold text-slate-500">Personal information and address only.</p></div>
        <div className="flex gap-2 sm:justify-end">
          <button type="button" onClick={() => router.push("/customers")} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600">Cancel</button>
          <button disabled={saving} className="min-w-[180px] rounded-2xl bg-gradient-to-r from-[#0b2f6b] to-[#2563eb] px-6 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(37,99,235,.28)] disabled:opacity-50">{saving ? "Saving…" : customer?.id ? "✓ Update Customer" : "✓ Save Customer"}</button>
        </div>
      </div>

      <button type="button" onClick={() => router.push("/dashboard")} className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-3 rounded-[22px] border border-[#dbe5f2] bg-white px-5 py-4 text-sm font-black text-[#173b76] shadow-[0_18px_50px_rgba(7,26,60,.18)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(7,26,60,.22)]">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#0b2f6b] to-[#2563eb] text-white">←</span>
        Dashboard
      </button>
    </form>
  );
}

function Section({ no, eyebrow, title, subtitle, children }: { no: string; eyebrow: string; title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-[28px] border border-[#dce7f4] bg-white shadow-[0_16px_44px_rgba(25,55,95,.08)]"><div className="flex items-start gap-4 border-b border-[#e7eef7] bg-gradient-to-r from-[#f9fbff] to-[#eef5ff] px-5 py-5 sm:px-7"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#0a1d40] text-[10px] font-black text-white">{no}</span><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-blue-500">{eyebrow}</p><h2 className="mt-1 text-xl font-black text-[#10213f]">{title}</h2><p className="mt-1 text-xs font-semibold text-slate-400">{subtitle}</p></div></div><div className="p-5 sm:p-7">{children}</div></section>;
}
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>; }
const fieldClass = "mt-2 w-full rounded-2xl border border-[#d9e4f1] bg-[#f8fbff] px-4 py-3.5 text-sm font-bold text-[#10213f] outline-none transition placeholder:text-slate-300 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100/70";
function Input({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) { return <label className="text-xs font-black text-slate-600">{label}{required && <span className="text-red-500"> *</span>}<input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} className={fieldClass} /></label>; }
function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <label className="text-xs font-black text-slate-600">{label}<textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass} /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) { return <label className="text-xs font-black text-slate-600">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>{options.map(([v, l]) => <option key={v || "empty"} value={v}>{l}</option>)}</select></label>; }
