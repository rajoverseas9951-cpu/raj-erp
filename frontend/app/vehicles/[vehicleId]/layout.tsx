'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { moduleLabels, operationHref, type OperationalProfile, type VehicleModule, vehicleOperationsApi } from '@/lib/vehicle-operations';
import { vehicleApi, type Vehicle } from '@/lib/vehicles';
import { vehicleMasterApi, type VehicleMaster } from '@/lib/vehicle-masters';
import VehicleBrokerAgentBridge from '@/components/vehicles/VehicleBrokerAgentBridge';

type Props = { children: ReactNode };
type RequiredDocument = { key: string; label: string; module?: VehicleModule };

const BASE_DOCUMENTS: RequiredDocument[] = [
  { key: 'rc', label: 'RC Book / Registration Certificate' },
  { key: 'insurance', label: 'Insurance Policy', module: 'insurance' },
  { key: 'puc', label: 'PUC Certificate', module: 'puc' },
  { key: 'hsrp', label: 'HSRP Record', module: 'hsrp' },
];

const MODULE_DOCUMENTS: Partial<Record<VehicleModule, RequiredDocument>> = {
  fitness: { key: 'fitness', label: 'Fitness Certificate', module: 'fitness' },
  permit: { key: 'permit', label: 'Permit', module: 'permit' },
  tax: { key: 'tax', label: 'Tax Receipt', module: 'tax' },
  counter_tax: { key: 'counter_tax', label: 'Counter Tax Receipt', module: 'counter_tax' },
  sld: { key: 'sld', label: 'SLD Certificate', module: 'sld' },
  vltd: { key: 'vltd', label: 'VLTD Certificate', module: 'vltd' },
};

function normalize(value?: string) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function documentMatches(documentType: string, key: string) {
  const type = normalize(documentType);
  const aliases: Record<string, RegExp> = {
    rc: /\brc\b|registration certificate|registration book/,
    insurance: /insurance|policy/,
    puc: /\bpuc\b|pollution/,
    hsrp: /\bhsrp\b|number plate/,
    fitness: /fitness/,
    permit: /permit/,
    tax: /\btax\b/,
    counter_tax: /counter tax/,
    sld: /\bsld\b|speed limit/,
    vltd: /\bvltd\b|tracking device|location tracking/,
  };
  return aliases[key]?.test(type) ?? type === normalize(key);
}

export default function VehicleLayout({ children }: Props) {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const pathname = usePathname();
  const [eligible, setEligible] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [profile, setProfile] = useState<OperationalProfile | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleMaster[]>([]);

  const profilePath = `/vehicles/${vehicleId}`;
  const isProfile = pathname === profilePath || pathname === `${profilePath}/`;
  const isEdit = pathname === `${profilePath}/edit` || pathname === `${profilePath}/edit/`;

  useEffect(() => {
    if (!isProfile && !isEdit) return;
    vehicleApi.get(vehicleId).then(setVehicle).catch(() => setVehicle(null));
  }, [isProfile, isEdit, vehicleId]);

  useEffect(() => {
    if (!isProfile) {
      setEligible(false);
      setProfile(null);
      return;
    }
    vehicleOperationsApi.profile(vehicleId)
      .then((result) => {
        setProfile(result);
        const c = result.applicability.classification;
        setEligible(Boolean(c.privateCar || c.twoWheeler));
      })
      .catch(() => {
        setEligible(false);
        setProfile(null);
      });
  }, [isProfile, vehicleId]);

  // Vehicle Type is always resolved from the Vehicle Type Directory / master.
  useEffect(() => {
    if (!isProfile && !isEdit) return;
    vehicleMasterApi.list('vehicle_types')
      .then((rows) => setVehicleTypes(rows.filter((row) => row.status === 'active')))
      .catch(() => setVehicleTypes([]));
  }, [isProfile, isEdit]);

  const selectedVehicleType = useMemo(() => {
    if (!vehicle) return null;
    const byId = vehicleTypes.find((row) => row.id === vehicle.vehicle_type_id);
    if (byId) return byId;
    const raw = normalize(vehicle.vehicle_type);
    return vehicleTypes.find((row) => {
      const name = normalize(row.name);
      const code = normalize(row.code);
      return raw && (raw === name || raw === code || name.includes(raw) || raw.includes(name));
    }) ?? null;
  }, [vehicle, vehicleTypes]);

  const requiredDocuments = useMemo(() => {
    if (!profile) return BASE_DOCUMENTS;
    const applicable = new Set<VehicleModule>(Object.values(profile.applicability.groups).flat());
    const documents = BASE_DOCUMENTS.filter((doc) => !doc.module || applicable.has(doc.module));
    (Object.keys(MODULE_DOCUMENTS) as VehicleModule[]).forEach((module) => {
      const doc = MODULE_DOCUMENTS[module];
      if (doc && applicable.has(module) && !documents.some((row) => row.key === doc.key)) documents.push(doc);
    });
    return documents;
  }, [profile]);

  function documentAdded(doc: RequiredDocument) {
    if (!vehicle) return false;
    if (vehicle.documents?.some((row) => documentMatches(row.document_type, doc.key))) return true;
    if (!doc.module || !profile) return false;
    const current = profile.modules[doc.module]?.current;
    return Boolean(current?.documents?.length);
  }

  return (
    <>
      {children}
      {isEdit && vehicle && <VehicleBrokerAgentBridge vehicle={vehicle} />}

      {isProfile && vehicle && profile && (
        <section className="mx-auto mt-4 max-w-7xl px-3 sm:px-5 md:px-7">
          <div className="overflow-hidden rounded-[24px] border border-[#dce6f4] bg-white shadow-[0_12px_34px_rgba(26,64,120,.07)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/70 px-4 py-4 sm:px-5">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[.2em] text-blue-500">Vehicle documents</p>
                <h2 className="mt-0.5 text-lg font-black text-[#0b2147]">Required Documents</h2>
                <p className="mt-1 text-[10px] font-semibold text-slate-500">Only documents applicable to this vehicle type are shown.</p>
              </div>
              <div className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-blue-700">
                {selectedVehicleType?.name || vehicle.vehicle_type || 'Vehicle Type'} · Directory
              </div>
            </div>
            <div className="grid gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
              {requiredDocuments.map((doc) => {
                const added = documentAdded(doc);
                const href = doc.module ? operationHref(vehicleId, doc.module) : `/vehicles/${vehicleId}/edit`;
                return (
                  <a key={doc.key} href={href} className="group flex min-h-[92px] items-center gap-3 rounded-2xl border border-slate-100 bg-[#f8fbff] p-3.5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-md">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-black ${added ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{added ? '✓' : '▤'}</span>
                    <span className="min-w-0"><span className="block text-xs font-black text-[#0b2147]">{doc.label}</span><span className={`mt-1 block text-[9px] font-black uppercase tracking-wide ${added ? 'text-emerald-600' : 'text-amber-600'}`}>{added ? 'Added' : 'Not Added'}</span></span>
                    <span className="ml-auto text-blue-500 transition group-hover:translate-x-0.5">→</span>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {isProfile && vehicle?.broker_agent_enabled && (
        <section className="mx-auto mt-4 max-w-7xl px-3 sm:px-5 md:px-7">
          <div className="overflow-hidden rounded-[22px] border border-[#dce6f4] bg-white shadow-[0_10px_30px_rgba(26,64,120,.06)]">
            <div className="border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/60 px-4 py-3.5 sm:px-5">
              <p className="text-[8px] font-black uppercase tracking-[.2em] text-blue-500">Vehicle routing</p>
              <h2 className="mt-0.5 text-base font-black text-[#0b2147]">Broker / Agent Details</h2>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
              <div className="rounded-2xl border border-slate-100 bg-[#f8fbff] p-4"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Broker</p><p className="mt-1 text-sm font-black text-[#0b2147]">{vehicle.broker_name || '—'}</p></div>
              <div className="rounded-2xl border border-slate-100 bg-[#f8fbff] p-4"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Agent</p><p className="mt-1 text-sm font-black text-[#0b2147]">{vehicle.agent_name || '—'}</p></div>
            </div>
          </div>
        </section>
      )}
      {isProfile && eligible && (
        <section className="mx-auto -mt-1 max-w-7xl px-3 pb-5 sm:px-5 md:px-7">
          <div className="overflow-hidden rounded-[22px] border border-[#dce6f4] bg-white shadow-[0_10px_30px_rgba(26,64,120,.06)]">
            <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[.2em] text-blue-500">Registration service</p>
                <h2 className="mt-0.5 text-base font-black tracking-tight sm:text-lg">Renewal Registration</h2>
                <p className="mt-1 text-[10px] font-semibold text-slate-500">Private car / two wheeler registration renewal workflow.</p>
              </div>
              <a
                href={`/vehicles/${vehicleId}/operations/rto_process?mode=renewal-registration`}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#0b2b62] to-[#2563eb] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(37,99,235,.22)]"
              >
                Open Renewal Registration →
              </a>
            </div>
          </div>
        </section>
      )}
    </>
  );
}