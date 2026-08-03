"use client";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AuthenticationRedirectError } from "@/lib/api-client";
import { BRAND } from "@/config/brand";
import { useRouter } from "next/navigation";
import { Customer, customerApi } from "@/lib/customers";
import { scanDocument } from "@/lib/ocr";
import { applyOcrPrefill } from "@/lib/rc-ocr";
import { Vehicle, vehicleApi } from "@/lib/vehicles";
import {
  VehicleMaster,
  VehicleMasterType,
  vehicleMasterApi,
} from "@/lib/vehicle-masters";
type Values = Record<string, string>;
const initial: Values = {
  customer_id: "",
  vehicle_number: "",
  registration_date: "",
  registration_valid_upto: "",
  registration_authority: "",
  rto_office_id: "",
  state: "Gujarat",
  district: "",
  vehicle_type: "two_wheeler",
  vehicle_type_id: "",
  vehicle_class: "",
  vehicle_category: "",
  manufacturer: "",
  model: "",
  variant: "",
  variant_id: "",
  manufacturing_year: "",
  manufacturing_month: "",
  colour: "",
  fuel_type: "",
  manufacturer_id: "",
  model_id: "",
  colour_id: "",
  vehicle_class_id: "",
  vehicle_category_id: "",
  fuel_type_id: "",
  seating_capacity: "",
  cubic_capacity: "",
  gross_weight: "",
  unladen_weight: "",
  number_of_cylinders: "",
  emission_norms: "",
  horse_power: "",
  wheel_base: "",
  chassis_number: "",
  engine_number: "",
  financier: "",
  insurance_status: "not_added",
  fitness_status: "not_added",
  permit_status: "not_added",
  tax_status: "not_added",
  puc_status: "not_added",
  insurance_expiry: "",
  puc_expiry: "",
  fitness_expiry: "",
  permit_expiry: "",
  national_permit_expiry: "",
  tax_expiry: "",
  counter_tax_expiry: "",
  payment_due: "0",
};
function clean(v: string) {
  return v
    .replace(/[|{}<>©®]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[:;,._\-\\/\s]+|[:;,._\-\\/\s]+$/g, "")
    .trim();
}
function date(v: string) {
  const m = v.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}
function nextValue(lines: string[], label: RegExp, max = 3) {
  for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i])) continue;
    const same = clean(lines[i].replace(label, ""));
    if (same && same.length > 1) return same;
    for (let j = 1; j <= max; j++) {
      const n = clean(lines[i + j] ?? "");
      if (
        n &&
        !/regn|registration|chassis|engine|owner|fuel|address|vehicle class|maker|model|colour|body type|seating|unladen|cubic|financier|authority/i.test(
          n,
        )
      )
        return n;
    }
  }
  return "";
}
function validText(v: string, min = 2, max = 60) {
  return (
    v.length >= min &&
    v.length <= max &&
    /[A-Za-z0-9]/.test(v) &&
    !/^name$|^type$|^number$|^no$/i.test(v)
  );
}
function parseRc(text: string): Partial<Values> {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const joined = lines.join("\n");
  const out: Partial<Values> = {};
  const reg = joined.match(/\b[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4}\b/i);
  if (reg) out.vehicle_number = reg[0].replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const regLine = lines.find((l) =>
    /date of regn|date of registration|regn\.? date/i.test(l),
  );
  const regDate = regLine
    ? date(regLine) || date(lines[lines.indexOf(regLine) + 1] ?? "")
    : "";
  if (regDate) out.registration_date = regDate;
  const chassis = nextValue(lines, /chassis\s*(?:no|number)?/i)
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
  if (/^[A-Z0-9]{15,25}$/.test(chassis)) out.chassis_number = chassis;
  const engine = nextValue(
    lines,
    /engine\s*\/\s*motor\s*(?:no|number)?|engine\s*(?:no|number)?/i,
  )
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
  if (/^[A-Z0-9]{8,25}$/.test(engine)) out.engine_number = engine;
  const cls = nextValue(lines, /vehicle\s*class|class\s*of\s*vehicle/i);
  if (
    validText(cls, 4, 50) &&
    /cycle|scooter|car|goods|taxi|passenger|lmv|hgv|lgv/i.test(cls)
  )
    out.vehicle_class = cls.toUpperCase();
  const maker = nextValue(lines, /maker'?s?\s*name|manufacturer/i);
  if (validText(maker, 3, 50) && !/regn|number/i.test(maker))
    out.manufacturer = maker.toUpperCase();
  const model = nextValue(lines, /model\s*name|^model$/i);
  if (validText(model, 2, 50)) out.model = model.toUpperCase();
  const colour = nextValue(lines, /colour|color/i);
  if (validText(colour, 3, 40) && !/body type/i.test(colour))
    out.colour = colour.toUpperCase();
  const body = nextValue(lines, /body\s*type/i);
  if (validText(body, 3, 50) && !/colour|color/i.test(body))
    out.vehicle_category = body.toUpperCase();
  const fuel = joined.match(/\b(PETROL|DIESEL|CNG|LPG|ELECTRIC|BATTERY|EV)\b/i);
  if (fuel)
    out.fuel_type = /electric|battery|ev/i.test(fuel[1])
      ? "electric"
      : fuel[1].toLowerCase();
  const seat = nextValue(
    lines,
    /seating\s*\(in\s*all\)\s*capacity|seating\s*capacity/i,
  ).match(/\b[1-9]\d?\b/)?.[0];
  if (seat && Number(seat) <= 100) out.seating_capacity = seat;
  const cc = nextValue(lines, /cubic\s*cap(?:acity)?(?:\s*\/.*)?/i).match(
    /\b\d{2,5}(?:\.\d{1,2})?\b/,
  )?.[0];
  if (cc && Number(cc) >= 40) out.cubic_capacity = cc;
  const ulw = nextValue(lines, /unladen\s*weight/i).match(/\b\d{2,6}\b/)?.[0];
  if (ulw) out.unladen_weight = ulw;
  const gvw = nextValue(lines, /gross\s*(?:vehicle\s*)?weight/i).match(
    /\b\d{3,6}\b/,
  )?.[0];
  if (gvw) out.gross_weight = gvw;
  const fin = nextValue(lines, /financier/i);
  if (validText(fin, 3, 60)) out.financier = fin.toUpperCase();
  const auth = nextValue(
    lines,
    /registration\s*authority|registering\s*authority/i,
  );
  if (validText(auth, 3, 40)) {
    out.registration_authority = auth.toUpperCase();
    out.district = auth.toUpperCase();
  }
  const my = lines.findIndex((l) => /month[- ]?year\s*of\s*mfg/i.test(l));
  if (my >= 0) {
    const y = `${lines[my]} ${lines[my + 1] ?? ""}`.match(
      /(?:0?[1-9]|1[0-2])[-/](19\d{2}|20\d{2})/,
    )?.[1];
    if (y) out.manufacturing_year = y;
  }
  const c =
    `${out.vehicle_class ?? ""} ${out.vehicle_category ?? ""}`.toLowerCase();
  if (/m-?cycle|motor\s*cycle|scooter|2wn|two\s*wheeler/.test(c))
    out.vehicle_type = "two_wheeler";
  else if (/hgv|heavy\s*goods|truck|trailer/.test(c)) out.vehicle_type = "hgv";
  else if (/lgv|light\s*goods|pickup/.test(c)) out.vehicle_type = "lgv";
  else if (/taxi|cab|maxi|passenger/.test(c)) out.vehicle_type = "taxi";
  else if (/motor\s*car|private\s*car|lmv/.test(c))
    out.vehicle_type = "private_car";
  return out;
}
async function imageParts(file: File): Promise<Blob[]> {
  const b = await createImageBitmap(file);
  const tall = b.height > b.width * 1.35;
  const ranges = tall
    ? [
        [0, 0.43],
        [0.43, 0.86],
      ]
    : [[0, 1]];
  const parts: Blob[] = [];
  for (const [a, z] of ranges) {
    const sy = Math.round(b.height * a),
      sh = Math.round(b.height * (z - a));
    const scale = Math.max(1, Math.min(3.2, 2400 / b.width));
    const c = document.createElement("canvas");
    c.width = Math.round(b.width * scale);
    c.height = Math.round(sh * scale);
    const x = c.getContext("2d");
    if (!x) continue;
    x.drawImage(b, 0, sy, b.width, sh, 0, 0, c.width, c.height);
    const im = x.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < im.data.length; i += 4) {
      const g =
        im.data[i] * 0.299 + im.data[i + 1] * 0.587 + im.data[i + 2] * 0.114;
      const v = g > 200 ? 255 : g < 70 ? 0 : Math.round((g - 70) * 1.96);
      im.data[i] = v;
      im.data[i + 1] = v;
      im.data[i + 2] = v;
    }
    x.putImageData(im, 0, 0);
    parts.push(
      await new Promise((r) => c.toBlob((q) => r(q ?? file), "image/png", 1)),
    );
  }
  return parts;
}
export function VehicleForm({ vehicle }: { vehicle?: Partial<Vehicle> }) {
  const router = useRouter();
  const [mode, setMode] = useState<"rc" | "manual">("manual");
  const [values, setValues] = useState<Values>(() => {
    const dates = [
      "registration_date",
      "registration_valid_upto",
      "insurance_expiry",
      "puc_expiry",
      "fitness_expiry",
      "permit_expiry",
      "national_permit_expiry",
      "tax_expiry",
      "counter_tax_expiry",
    ];
    return {
      ...initial,
      ...Object.fromEntries(
        Object.entries(vehicle ?? {}).map(([k, v]) => [
          k,
          v == null
            ? ""
            : dates.includes(k)
              ? String(v).slice(0, 10)
              : String(v),
        ]),
      ),
      manufacturer_id: "",
      model_id: "",
    };
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customerLoadError, setCustomerLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [ownerSuggestion, setOwnerSuggestion] = useState("");
  const [ocrConfidence, setOcrConfidence] = useState<Record<string, number>>({});
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [masters, setMasters] = useState<
    Record<VehicleMasterType, VehicleMaster[]>
  >({
    manufacturers: [],
    models: [],
    variants: [],
    colours: [],
    vehicle_types: [],
    vehicle_classes: [],
    body_types: [],
    fuel_types: [],
    rto_offices: [],
  });
  const [masterModal, setMasterModal] = useState<VehicleMasterType>();
  const [masterSaving, setMasterSaving] = useState(false);
  const [masterLoading, setMasterLoading] = useState(true);
  const [masterLoadError, setMasterLoadError] = useState("");
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState("");
  const savedManufacturerId = useRef(String(vehicle?.manufacturer_id ?? ""));
  const savedModelId = useRef(String(vehicle?.model_id ?? ""));
  const savedModelName = useRef(String(vehicle?.model ?? ""));
  const modelRequest = useRef(0);
  const editedFields = useRef(new Set<string>());
  useEffect(() => {
    void loadCustomers();
  }, []);
  useEffect(() => {
    void loadMasters();
  }, []);
  useEffect(() => {
    if (!values.manufacturer_id) {
      setMasters((current) => ({ ...current, models: [] }));
      setModelError("");
      setModelLoading(false);
      return;
    }
    void loadModels(
      values.manufacturer_id,
      savedModelId.current,
      savedModelName.current,
    );
    savedModelId.current = "";
    savedModelName.current = "";
  }, [values.manufacturer_id]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !masterSaving) setMasterModal(undefined);
    };
    addEventListener("keydown", close);
    return () => removeEventListener("keydown", close);
  }, [masterSaving]);
  const set = (n: string, v: string) => {
    editedFields.current.add(n);
    setOcrConfidence((current) => {
      if (!(n in current)) return current;
      const next = { ...current };
      delete next[n];
      return next;
    });
    setValues((o) => ({ ...o, [n]: v }));
  };
  const setMany = (changes: Record<string, string>) => {
    Object.keys(changes).forEach((field) => editedFields.current.add(field));
    setOcrConfidence((current) => {
      const next = { ...current };
      Object.keys(changes).forEach((field) => delete next[field]);
      return next;
    });
    setValues((current) => ({ ...current, ...changes }));
  };
  const confidence = (field: string) => ocrConfidence[field];
  async function loadCustomers() {
    setCustomersLoading(true);
    setCustomerLoadError("");
    try {
      const response = await customerApi.list("?per_page=500");
      setCustomers(response.data ?? []);
    } catch (e) {
      if (e instanceof AuthenticationRedirectError) return;
      setCustomerLoadError(
        e instanceof Error ? e.message : "Customers could not load.",
      );
    } finally {
      setCustomersLoading(false);
    }
  }
  async function loadMasters() {
    type NonModelMaster = Exclude<VehicleMasterType, "models">;
    const types: NonModelMaster[] = [
      "manufacturers",
      "variants",
      "colours",
      "vehicle_types",
      "vehicle_classes",
      "body_types",
      "fuel_types",
      "rto_offices",
    ];
    setMasterLoading(true);
    setMasterLoadError("");
    try {
      const lists = await Promise.all(
        types.map((type) => vehicleMasterApi.list(type)),
      );
      const loaded = Object.fromEntries(
        types.map((type, index) => [type, lists[index]]),
      ) as Record<NonModelMaster, VehicleMaster[]>;
      setMasters((current) => ({ ...current, ...loaded }));
      setValues((current) => {
        const match = (type: NonModelMaster, name: string) =>
          loaded[type].find((x) => x.name.toUpperCase() === name.toUpperCase())
            ?.id ?? "";
        const manufacturerId =
          savedManufacturerId.current ||
          current.manufacturer_id ||
          match("manufacturers", current.manufacturer);
        savedManufacturerId.current = "";
        return {
          ...current,
          manufacturer_id: manufacturerId,
          model_id: current.model_id,
          variant_id: current.variant_id || match("variants", current.variant),
          vehicle_type_id: current.vehicle_type_id || match("vehicle_types", current.vehicle_type),
          rto_office_id: current.rto_office_id || match("rto_offices", current.registration_authority),
          colour_id: current.colour_id || match("colours", current.colour),
          vehicle_class_id:
            current.vehicle_class_id ||
            match("vehicle_classes", current.vehicle_class),
          vehicle_category_id:
            current.vehicle_category_id ||
            match("body_types", current.vehicle_category),
          fuel_type_id:
            current.fuel_type_id || match("fuel_types", current.fuel_type),
        };
      });
    } catch (e) {
      if (e instanceof AuthenticationRedirectError) return;
      console.error("Vehicle master API load failed", e);
      setMasterLoadError(
        e instanceof Error ? e.message : "Master dropdowns could not load.",
      );
    } finally {
      setMasterLoading(false);
    }
  }
  async function loadModels(
    manufacturerId: string,
    selectId = "",
    selectName = "",
  ) {
    const requestId = ++modelRequest.current;
    setModelLoading(true);
    setModelError("");
    try {
      const models = await vehicleMasterApi.models(manufacturerId);
      if (requestId !== modelRequest.current) return;
      const sorted = models
        .filter(
          (model) =>
            model.status === "active" && model.parent_id === manufacturerId,
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      setMasters((current) => ({ ...current, models: sorted }));
      const selectedId = sorted.some((model) => model.id === selectId)
        ? selectId
        : (sorted.find(
            (model) =>
              selectName &&
              model.name.localeCompare(selectName, undefined, {
                sensitivity: "accent",
              }) === 0,
          )?.id ?? "");
      const selected = sorted.find((model) => model.id === selectedId);
      setValues((current) =>
        editedFields.current.has("model") || editedFields.current.has("model_id")
          ? current
          : {
              ...current,
              model_id: selectedId,
              model: selected?.name ?? "",
            },
      );
    } catch (e) {
      if (requestId !== modelRequest.current) return;
      console.error("Vehicle models API load failed", e);
      setMasters((current) => ({ ...current, models: [] }));
      setValues((current) =>
        editedFields.current.has("model") || editedFields.current.has("model_id")
          ? current
          : { ...current, model_id: "", model: "" },
      );
      setModelError(e instanceof Error ? e.message : "Models could not load.");
    } finally {
      if (requestId === modelRequest.current) setModelLoading(false);
    }
  }
  async function addMaster(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!masterModal || masterSaving) return;
    setMasterSaving(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const created = await vehicleMasterApi.create(masterModal, {
        name: fd.get("name"),
        code: fd.get("code"),
        parent_id: masterModal === "models" ? values.manufacturer_id : masterModal === "variants" ? values.model_id : null,
        status: "active",
      });
      if (masterModal === "models")
        await loadModels(values.manufacturer_id, created.id, created.name);
      else await loadMasters();
      const fields: Record<VehicleMasterType, [string, string]> = {
        manufacturers: ["manufacturer_id", "manufacturer"],
        models: ["model_id", "model"],
        variants: ["variant_id", "variant"],
        colours: ["colour_id", "colour"],
        vehicle_types: ["vehicle_type_id", "vehicle_type"],
        vehicle_classes: ["vehicle_class_id", "vehicle_class"],
        body_types: ["vehicle_category_id", "vehicle_category"],
        fuel_types: ["fuel_type_id", "fuel_type"],
        rto_offices: ["rto_office_id", "registration_authority"],
      };
      const [idField, nameField] = fields[masterModal];
      setMany({
        [idField]: created.id,
        [nameField]: created.name,
        ...(masterModal === "manufacturers" ? { model_id: "", model: "", variant_id: "", variant: "" } : {}),
        ...(masterModal === "models" ? { variant_id: "", variant: "" } : {}),
      });
      setMasterModal(undefined);
      setSuccess(`${created.name} added and selected.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Master could not be saved.");
    } finally {
      setMasterSaving(false);
    }
  }
  async function readRc() {
    if (!front && !back) {
      setError("Pehle RC image upload karo.");
      return;
    }
    setReading(true);
    setProgress(20);
    setError("");
    setSuccess("");
    try {
      const files = [front, back].filter(Boolean) as File[];
      const unique = files.filter(
        (f, i, a) =>
          a.findIndex(
            (x) =>
              x.name === f.name &&
              x.size === f.size &&
              x.lastModified === f.lastModified,
          ) === i,
      );
      const result = await scanDocument("rc", unique);
      const extracted = result.fields;
      setProgress(100);
      savedModelId.current = extracted.model_id ?? "";
      savedModelName.current = extracted.model ?? "";
      setValues((old) => applyOcrPrefill(old, extracted, editedFields.current));
      setOwnerSuggestion(extracted.owner_name ?? "");
      setOcrConfidence(
        Object.fromEntries(
          Object.entries(result.field_confidence ?? {}).filter(
            ([field]) => !editedFields.current.has(field),
          ),
        ),
      );
      if (result.masters) {
        setMasters((current) => {
          const next = { ...current };
          for (const [type, master] of Object.entries(result.masters ?? {})) {
            if (!master) continue;
            const key = type as VehicleMasterType;
            next[key] = [
              ...next[key].filter((item) => item.id !== master.id),
              master,
            ];
          }
          return next;
        });
      }
      const count = Object.keys(extracted).length;
      setSuccess(
        count
          ? `RC se ${count} details fill hui. Save se pehle verify kar lena.${result.warnings?.length ? ` ${result.warnings[0]}` : ""}`
          : "RC se reliable detail nahi mili. Manual entry use karo.",
      );
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "RC clear read nahi hui. Manual entry available hai.",
      );
    } finally {
      setReading(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        ...values,
        hypothecation: Boolean(values.financier),
        manufacturing_year: values.manufacturing_year
          ? Number(values.manufacturing_year)
          : null,
        manufacturing_month: values.manufacturing_month
          ? Number(values.manufacturing_month)
          : null,
        seating_capacity: values.seating_capacity
          ? Number(values.seating_capacity)
          : null,
        cubic_capacity: values.cubic_capacity
          ? Number(values.cubic_capacity)
          : null,
        gross_weight: values.gross_weight ? Number(values.gross_weight) : null,
        unladen_weight: values.unladen_weight
          ? Number(values.unladen_weight)
          : null,
        number_of_cylinders: values.number_of_cylinders
          ? Number(values.number_of_cylinders)
          : null,
        horse_power: values.horse_power ? Number(values.horse_power) : null,
        wheel_base: values.wheel_base ? Number(values.wheel_base) : null,
        payment_due: Number(values.payment_due || 0),
      };
      const saved = vehicle?.id
        ? await vehicleApi.update(vehicle.id, body)
        : await vehicleApi.create(body);
      router.push(`/vehicles/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vehicle save nahi hua.");
    } finally {
      setSaving(false);
    }
  }
  const commercial = ["lgv", "hgv", "taxi"].includes(values.vehicle_type),
    hgv = values.vehicle_type === "hgv",
    taxi = values.vehicle_type === "taxi";
  const customerOptions = useMemo(
    () =>
      customers.filter((customer) =>
        `${customer.first_name} ${customer.middle_name ?? ""} ${customer.last_name} ${customer.mobile}`
          .toLowerCase()
          .includes(customerSearch.toLowerCase()),
      ),
    [customers, customerSearch],
  );
  const requiredFields = [
    values.customer_id,
    values.vehicle_number,
    values.chassis_number,
    values.engine_number,
  ];
  const completedRequired = requiredFields.filter(Boolean).length;
  const completion = Math.round(
    (completedRequired / requiredFields.length) * 100,
  );
  return (
    <>
      <form onSubmit={submit} className="space-y-6 pb-40 sm:pb-28">
        <section className="overflow-hidden rounded-[20px] border border-white/20 bg-white shadow-[0_20px_55px_rgba(15,23,42,.12)]">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#070b22] via-[#142766] to-[#2563eb] p-6 text-white sm:p-8">
            <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="relative flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-200">
                  {BRAND.brandName} · Vehicle onboarding
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  {vehicle ? "Edit Vehicle" : "Add Vehicle"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                  Select the customer manually. RC OCR fills vehicle details
                  only; review every value before saving.
                </p>
              </div>
              <Link
                href="/vehicles"
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold backdrop-blur hover:bg-white/20"
              >
                ← Back to Vehicles
              </Link>
            </div>
            <div className="relative mt-6">
              <div className="flex justify-between text-xs font-bold">
                <span>Required details</span>
                <span>
                  {completedRequired}/{requiredFields.length} complete
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-white transition-all"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
          </div>
          <nav
            aria-label="Vehicle form progress"
            className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-white p-4 sm:grid-cols-4 sm:p-5"
          >
            {[
              "Owner & Registration",
              "Vehicle Details",
              "Technical Details",
              "Insurance & Compliance",
            ].map((label, index) => (
              <a
                key={label}
                href={`#vehicle-step-${index + 1}`}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] text-white">
                  {index + 1}
                </span>
                {label}
              </a>
            ))}
          </nav>
          <div className="grid gap-3 p-5 md:grid-cols-2">
            <Mode
              active={mode === "rc"}
              title="RC Book Upload"
              text="Upload front, back or combined RC and extract real OCR details."
              onClick={() => setMode("rc")}
            />
            <Mode
              active={mode === "manual"}
              title="Manual Entry"
              text="Enter all vehicle details yourself with full control."
              onClick={() => setMode("manual")}
            />
          </div>
          {mode === "rc" && (
            <div className="grid gap-4 border-t p-5 md:grid-cols-2">
              <FileBox
                label="RC Front / Combined"
                file={front}
                onChange={setFront}
              />
              <FileBox
                label="RC Back (optional)"
                file={back}
                onChange={setBack}
              />
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={readRc}
                  disabled={reading || (!front && !back)}
                  className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 font-bold text-white shadow-lg disabled:opacity-40"
                >
                  {reading ? `Reading RC… ${progress}%` : "Read RC Details"}
                </button>
                {reading && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-blue-600"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
                <p className="mt-3 text-center text-xs font-semibold text-amber-700">
                  OCR data must be reviewed before saving.
                </p>
              </div>
            </div>
          )}
        </section>
        {masterLoadError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div>
              <strong>Master dropdowns could not load.</strong>
              <p className="mt-1 text-sm">{masterLoadError}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadMasters()}
              disabled={masterLoading}
              className="rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {masterLoading ? "Retrying…" : "Retry"}
            </button>
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-700">
            {success}
          </div>
        )}
        <div id="vehicle-step-1" className="scroll-mt-6">
          <Card title="Owner & Registration">
            <div className="md:col-span-2 xl:col-span-3">
              <div className="mb-2 flex justify-between">
                <span className="text-sm font-bold">Find Customer</span>
                <Link
                  href="/customers/new"
                  className="text-xs font-bold text-blue-700"
                >
                  + Create New Customer
                </Link>
              </div>
              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search by name or mobile"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              {customerLoadError && (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                  <span>{customerLoadError}</span>
                  <button
                    type="button"
                    onClick={() => void loadCustomers()}
                    className="font-black"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
            <Select
              label="Customer"
              value={values.customer_id}
              onChange={(v) => set("customer_id", v)}
              required
              options={customerOptions.map((c) => ({
                value: c.id,
                label: `${c.first_name} ${c.middle_name ?? ""} ${c.last_name} — ${c.mobile}${c.city ? ` · ${c.city}` : ""}`,
              }))}
              loading={customersLoading}
            />
            {ownerSuggestion && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 md:col-span-2">
                RC owner detected: <strong>{ownerSuggestion}</strong>. Select an
                existing customer, create one, or ignore this suggestion if the
                vehicle was transferred.
              </div>
            )}
            <Input
              label="Vehicle Number"
              hint="Example: GJ04CA4751"
              value={values.vehicle_number}
              onChange={(v) =>
                set(
                  "vehicle_number",
                  v.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
                )
              }
              required
              confidence={confidence("vehicle_number")}
            />
            <Input
              label="Registration Date"
              type="date"
              value={values.registration_date}
              onChange={(v) => set("registration_date", v)}
              confidence={confidence("registration_date")}
            />
            <Input
              label="Registration Validity"
              type="date"
              value={values.registration_valid_upto}
              onChange={(v) => set("registration_valid_upto", v)}
              confidence={confidence("registration_valid_upto")}
            />
            <MasterSelect
              label="Registration Authority / RTO"
              value={values.rto_office_id}
              onChange={(id) => {
                const item = masters.rto_offices.find((row) => row.id === id);
                setMany({ rto_office_id: id, registration_authority: item?.name ?? "" });
              }}
              options={masters.rto_offices}
              add={() => setMasterModal("rto_offices")}
              loading={masterLoading}
              confidence={confidence("registration_authority")}
            />
            <Input
              label="State"
              value={values.state}
              onChange={(v) => set("state", v)}
              confidence={confidence("state")}
            />
            <Input
              label="District"
              value={values.district}
              onChange={(v) => set("district", v)}
              confidence={confidence("district")}
            />
            <MasterSelect
              label="Vehicle Type"
              value={values.vehicle_type_id}
              onChange={(id) => {
                const item = masters.vehicle_types.find((row) => row.id === id);
                setMany({ vehicle_type_id: id, vehicle_type: item?.code?.toLowerCase() || item?.name.toLowerCase().replaceAll(" ", "_") || "" });
              }}
              options={masters.vehicle_types}
              add={() => setMasterModal("vehicle_types")}
              loading={masterLoading}
              confidence={confidence("vehicle_type")}
            />
          </Card>
        </div>
        <div id="vehicle-step-2" className="scroll-mt-6">
          <Card title="Vehicle Details">
            <MasterSelect
              label="Vehicle Class"
              value={values.vehicle_class_id}
              onChange={(id) => {
                const item = masters.vehicle_classes.find((x) => x.id === id);
                setMany({
                  vehicle_class_id: id,
                  vehicle_class: item?.name ?? "",
                });
              }}
              options={masters.vehicle_classes}
              add={() => setMasterModal("vehicle_classes")}
              loading={masterLoading}
              confidence={confidence("vehicle_class")}
            />
            <MasterSelect
              label="Vehicle Category / Body Type"
              value={values.vehicle_category_id}
              onChange={(id) => {
                const item = masters.body_types.find((x) => x.id === id);
                setMany({
                  vehicle_category_id: id,
                  vehicle_category: item?.name ?? "",
                });
              }}
              options={masters.body_types}
              add={() => setMasterModal("body_types")}
              loading={masterLoading}
              confidence={confidence("vehicle_category")}
            />
            <MasterSelect
              label="Manufacturer"
              value={values.manufacturer_id}
              onChange={(id) => {
                const item = masters.manufacturers.find((x) => x.id === id);
                savedModelId.current = "";
                savedModelName.current = "";
                if (values.manufacturer_id !== id) {
                  setMany({
                    manufacturer_id: id,
                    manufacturer: item?.name ?? "",
                    model_id: "",
                    model: "",
                    variant_id: "",
                    variant: "",
                  });
                }
              }}
              options={masters.manufacturers}
              add={() => setMasterModal("manufacturers")}
              loading={masterLoading}
              confidence={confidence("manufacturer")}
            />
            <MasterSelect
              label="Model"
              value={values.model_id}
              onChange={(id) => {
                const item = masters.models.find((x) => x.id === id);
                setMany({
                  model_id: id,
                  model: item?.name ?? "",
                  variant_id: "",
                  variant: "",
                });
              }}
              options={masters.models}
              add={() =>
                values.manufacturer_id
                  ? setMasterModal("models")
                  : setError("Select a manufacturer before adding a model.")
              }
              loading={modelLoading}
              disabled={!values.manufacturer_id}
              error={modelError}
              placeholder="Select Model"
              emptyLabel="No models found"
              confidence={confidence("model")}
            />
            <MasterSelect
              label="Variant"
              value={values.variant_id}
              onChange={(id) => {
                const item = masters.variants.find((row) => row.id === id);
                setMany({ variant_id: id, variant: item?.name ?? "" });
              }}
              options={masters.variants.filter((row) => row.parent_id === values.model_id)}
              add={() => values.model_id ? setMasterModal("variants") : setError("Select a model before adding a variant.")}
              loading={masterLoading}
              disabled={!values.model_id}
              placeholder="Select Variant"
              emptyLabel="No variants found"
              confidence={confidence("variant")}
            />
            <Input
              label="Manufacturing Year"
              type="number"
              value={values.manufacturing_year}
              onChange={(v) => set("manufacturing_year", v)}
              confidence={confidence("manufacturing_year")}
            />
            <Input
              label="Manufacturing Month"
              type="number"
              value={values.manufacturing_month}
              onChange={(v) => set("manufacturing_month", v)}
              confidence={confidence("manufacturing_month")}
            />
            <MasterSelect
              label="Colour"
              value={values.colour_id}
              onChange={(id) => {
                const item = masters.colours.find((x) => x.id === id);
                setMany({
                  colour_id: id,
                  colour: item?.name ?? "",
                });
              }}
              options={masters.colours}
              add={() => setMasterModal("colours")}
              loading={masterLoading}
              confidence={confidence("colour")}
            />
            <MasterSelect
              label="Fuel Type"
              value={values.fuel_type_id}
              onChange={(id) => {
                const item = masters.fuel_types.find((x) => x.id === id);
                setMany({
                  fuel_type_id: id,
                  fuel_type: item?.name ?? "",
                });
              }}
              options={masters.fuel_types}
              add={() => setMasterModal("fuel_types")}
              loading={masterLoading}
              confidence={confidence("fuel_type")}
            />
            <Input
              label="Seating Capacity"
              type="number"
              value={values.seating_capacity}
              onChange={(v) => set("seating_capacity", v)}
              confidence={confidence("seating_capacity")}
            />
            <Input
              label="Cubic Capacity"
              type="number"
              value={values.cubic_capacity}
              onChange={(v) => set("cubic_capacity", v)}
              step="0.01"
              confidence={confidence("cubic_capacity")}
            />
            <Input
              label="Unladen Weight (kg)"
              type="number"
              value={values.unladen_weight}
              onChange={(v) => set("unladen_weight", v)}
              confidence={confidence("unladen_weight")}
            />
            {commercial && (
              <>
                <Input
                  label="Gross Weight"
                  type="number"
                  value={values.gross_weight}
                  onChange={(v) => set("gross_weight", v)}
                  confidence={confidence("gross_weight")}
                />
              </>
            )}
          </Card>
        </div>
        <div id="vehicle-step-3" className="scroll-mt-6">
          <Card title="Technical Details">
            <Input
              label="Chassis Number"
              value={values.chassis_number}
              onChange={(v) => set("chassis_number", v.toUpperCase())}
              required
              confidence={confidence("chassis_number")}
            />
            <Input
              label="Engine Number"
              value={values.engine_number}
              onChange={(v) => set("engine_number", v.toUpperCase())}
              required
              confidence={confidence("engine_number")}
            />
            <Input
              label="Number of Cylinders"
              type="number"
              value={values.number_of_cylinders}
              onChange={(v) => set("number_of_cylinders", v)}
              confidence={confidence("number_of_cylinders")}
            />
            <Input
              label="Emission Norms"
              value={values.emission_norms}
              onChange={(v) => set("emission_norms", v)}
              confidence={confidence("emission_norms")}
            />
            <Input
              label="Horse Power (BHP/kW)"
              type="number"
              step="0.01"
              value={values.horse_power}
              onChange={(v) => set("horse_power", v)}
              confidence={confidence("horse_power")}
            />
            <Input
              label="Wheel Base (mm)"
              type="number"
              value={values.wheel_base}
              onChange={(v) => set("wheel_base", v)}
              confidence={confidence("wheel_base")}
            />
            <Input
              label="Financier / Hypothecation"
              value={values.financier}
              onChange={(v) => set("financier", v)}
              confidence={confidence("financier")}
            />
            <Input
              label="Payment Due"
              type="number"
              value={values.payment_due}
              onChange={(v) => set("payment_due", v)}
            />
          </Card>
        </div>
        <div id="vehicle-step-4" className="scroll-mt-6">
          <Card title="Insurance & Compliance">
            <Expiry
              label="Insurance"
              status={values.insurance_status}
              expiry={values.insurance_expiry}
              setStatus={(v) => set("insurance_status", v)}
              setExpiry={(v) => set("insurance_expiry", v)}
            />
            <Expiry
              label="PUC"
              status={values.puc_status}
              expiry={values.puc_expiry}
              setStatus={(v) => set("puc_status", v)}
              setExpiry={(v) => set("puc_expiry", v)}
            />
            {commercial && (
              <Expiry
                label="Fitness"
                status={values.fitness_status}
                expiry={values.fitness_expiry}
                setStatus={(v) => set("fitness_status", v)}
                setExpiry={(v) => set("fitness_expiry", v)}
              />
            )}{" "}
            {(hgv || taxi) && (
              <>
                <Expiry
                  label="Permit"
                  status={values.permit_status}
                  expiry={values.permit_expiry}
                  setStatus={(v) => set("permit_status", v)}
                  setExpiry={(v) => set("permit_expiry", v)}
                />
                <Expiry
                  label="National Permit"
                  status={values.permit_status}
                  expiry={values.national_permit_expiry}
                  setStatus={(v) => set("permit_status", v)}
                  setExpiry={(v) => set("national_permit_expiry", v)}
                />
              </>
            )}
            {hgv && (
              <>
                <Expiry
                  label="Tax"
                  status={values.tax_status}
                  expiry={values.tax_expiry}
                  setStatus={(v) => set("tax_status", v)}
                  setExpiry={(v) => set("tax_expiry", v)}
                />
                <Expiry
                  label="Counter Tax"
                  status={values.tax_status}
                  expiry={values.counter_tax_expiry}
                  setStatus={(v) => set("tax_status", v)}
                  setExpiry={(v) => set("counter_tax_expiry", v)}
                />
              </>
            )}
          </Card>
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-end border-t bg-white/95 p-4 backdrop-blur lg:left-[260px]">
          <div className="flex w-full flex-col-reverse justify-end gap-3 sm:flex-row">
            <Link
              href="/vehicles"
              className="rounded-xl border border-slate-200 px-6 py-3 text-center font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              disabled={saving || reading}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3 font-bold text-white shadow-lg shadow-blue-200 disabled:opacity-60"
            >
              {saving ? "Saving vehicle…" : "Save Vehicle"}
            </button>
          </div>
        </div>
      </form>
      {masterModal && (
        <MasterModal
          type={masterModal}
          saving={masterSaving}
          close={() => setMasterModal(undefined)}
          save={addMaster}
          manufacturer={values.manufacturer}
        />
      )}
    </>
  );
}
function Mode({
  active,
  title,
  text,
  onClick,
}: {
  active: boolean;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`group rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${active ? "border-blue-600 bg-gradient-to-br from-blue-50 to-indigo-50 ring-4 ring-blue-50" : "border-slate-200 bg-white"}`}
    >
      <span
        className={`mb-4 grid h-11 w-11 place-items-center rounded-xl text-xl ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}
      >
        {title.startsWith("RC") ? "▣" : "✎"}
      </span>
      <b className="text-base">{title}</b>
      <p className="mt-1 text-sm leading-5 text-slate-500">{text}</p>
    </button>
  );
}
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,.06)] sm:p-6">
      <h2 className="mb-5 border-b border-slate-100 pb-4 text-lg font-black text-slate-900">
        {title}
      </h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}
function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  hint,
  step,
  confidence,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
  step?: string;
  confidence?: number;
}) {
  const lowConfidence = confidence !== undefined && confidence < 0.8;
  return (
    <label className="text-sm font-semibold">
      {label}
      {required && <span className="text-red-500"> *</span>}
      <input
        type={type}
        value={value}
        required={required}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ${lowConfidence ? "border-amber-400 bg-amber-50/50" : "border-slate-200"}`}
      />
      {hint && (
        <span className="mt-1 block text-xs font-normal text-slate-400">
          {hint}
        </span>
      )}
      {lowConfidence && (
        <span className="mt-1 block text-xs font-semibold text-amber-700">
          Low OCR confidence ({Math.round((confidence ?? 0) * 100)}%) — please review.
        </span>
      )}
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
  required = false,
  loading = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: {
    value: string;
    label: string;
  }[];
  required?: boolean;
  loading?: boolean;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      {required && <span className="text-red-500"> *</span>}
      <select
        value={value}
        required={required}
        disabled={loading}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"
      >
        <option value="">
          {loading
            ? "Loading…"
            : options.length
              ? "Select"
              : "No active records found"}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function MasterSelect({
  label,
  value,
  onChange,
  options,
  add,
  loading = false,
  disabled = false,
  error = "",
  placeholder = "Select",
  emptyLabel = "No active records found",
  confidence,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: VehicleMaster[];
  add: () => void;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  emptyLabel?: string;
  confidence?: number;
}) {
  const lowConfidence = confidence !== undefined && confidence < 0.8;
  const active = options
    .filter((x) => x.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div>
      <label className="text-sm font-semibold">
        {label}
        <select
          value={value}
          disabled={disabled || loading}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-2 w-full rounded-xl border px-4 py-3 font-normal disabled:bg-slate-100 ${lowConfidence ? "border-amber-400 bg-amber-50/50" : "bg-white"}`}
        >
          <option value="">
            {loading
              ? "Loading..."
              : disabled
                ? "Select manufacturer first"
                : active.length
                  ? placeholder
                  : emptyLabel}
          </option>
          {active.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {lowConfidence && (
        <p className="mt-1 text-xs font-semibold text-amber-700">
          Low OCR confidence ({Math.round((confidence ?? 0) * 100)}%) — please review.
        </p>
      )}
      <button
        type="button"
        onClick={add}
        disabled={loading}
        className="mt-2 text-sm font-bold text-blue-700 disabled:text-slate-400"
      >
        + Add {label}
      </button>
    </div>
  );
}
function MasterModal({
  type,
  saving,
  close,
  save,
  manufacturer,
}: {
  type: VehicleMasterType;
  saving: boolean;
  close: () => void;
  save: (e: FormEvent<HTMLFormElement>) => void;
  manufacturer: string;
}) {
  const labels: Record<VehicleMasterType, string> = {
    manufacturers: "Manufacturer",
    models: "Vehicle Model",
    variants: "Vehicle Variant",
    colours: "Vehicle Colour",
    vehicle_types: "Vehicle Type",
    vehicle_classes: "Vehicle Class",
    body_types: "Body Type",
    fuel_types: "Fuel Type",
    rto_offices: "RTO Office",
  };
  const label = labels[type];
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) close();
      }}
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4"
    >
      <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex justify-between">
          <h2 className="text-xl font-black">Add {label}</h2>
          <button type="button" disabled={saving} onClick={close}>
            ✕
          </button>
        </div>
        {type === "models" && (
          <p className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
            Manufacturer: <strong>{manufacturer}</strong>
          </p>
        )}
        <form onSubmit={save} className="space-y-4">
          <label className="block text-sm font-semibold">
            Name
            <input
              name="name"
              required
              autoFocus
              className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            Code
            <input
              name="code"
              className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={close}
              className="rounded-xl border px-5 py-3"
            >
              Cancel
            </button>
            <button
              disabled={saving}
              className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white"
            >
              {saving ? "Saving…" : `Save ${label}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function FileBox({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm">
      <label className="block cursor-pointer font-bold">
        {label}
        <span className="mt-1 block text-xs font-normal text-slate-500">
          JPG, PNG or WEBP · click to select or replace
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="mt-3 block w-full text-sm font-normal"
        />
      </label>
      {file && <FilePreview file={file} remove={() => onChange(null)} />}
    </div>
  );
}
function FilePreview({ file, remove }: { file: File; remove: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {url && (
        <img
          src={url}
          alt={`${file.name} preview`}
          className="h-36 w-full bg-slate-100 object-contain"
        />
      )}
      <div className="flex items-center justify-between gap-3 p-3">
        <span className="min-w-0 truncate font-semibold text-slate-700">
          {file.name}
        </span>
        <button
          type="button"
          onClick={remove}
          className="text-xs font-bold text-red-600"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
function Expiry({
  label,
  status,
  expiry,
  setStatus,
  setExpiry,
}: {
  label: string;
  status: string;
  expiry: string;
  setStatus: (v: string) => void;
  setExpiry: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="font-semibold">{label}</p>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="mt-3 w-full rounded-lg border bg-white p-2"
      >
        <option value="not_added">Not Added</option>
        <option value="active">Active</option>
        <option value="valid">Valid</option>
        <option value="expiring_soon">Expiring Soon</option>
        <option value="expired">Expired</option>
        <option value="paid">Paid</option>
        <option value="due">Due</option>
        <option value="overdue">Overdue</option>
      </select>
      <input
        type="date"
        value={expiry}
        onChange={(e) => setExpiry(e.target.value)}
        className="mt-3 w-full rounded-lg border p-2"
      />
    </div>
  );
}
