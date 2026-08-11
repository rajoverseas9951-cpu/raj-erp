"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Fleet, fleetApi } from "@/lib/fleets";

export function FleetVehiclePicker() {
  const search = useSearchParams();
  const [rows, setRows] = useState<Fleet[]>([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    fleetApi.list().then(setRows).catch(() => undefined);
  }, []);

  useEffect(() => {
    const q = search.get("fleet") || "";
    setSelected(q);
    document.cookie = `raj_fleet_id=${q}; Path=/; SameSite=Lax${q ? "" : "; Max-Age=0"}`;
  }, [search]);

  function choose(value: string) {
    setSelected(value);
    document.cookie = value
      ? `raj_fleet_id=${value}; Path=/; SameSite=Lax`
      : "raj_fleet_id=; Path=/; Max-Age=0; SameSite=Lax";
  }

  const activeFleet = useMemo(
    () => rows.find((fleet) => fleet.id === selected),
    [rows, selected],
  );

  return (
    <div className="mx-auto max-w-[1500px] px-3 pt-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[20px] border border-slate-200/80 bg-white/95 shadow-[0_12px_34px_rgba(15,23,42,.06)] backdrop-blur">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-400 via-blue-500 to-indigo-600" />

        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-[#082654] to-[#2563eb] text-white shadow-[0_8px_18px_rgba(37,99,235,.22)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 15.5V8.8c0-.8.5-1.5 1.2-1.8l4.5-1.8c.5-.2 1-.2 1.5 0L14.7 7c.8.3 1.3 1 1.3 1.8v6.7" />
                <path d="M16 10h2.8c.8 0 1.5.5 1.8 1.2l.9 2.3v2" />
                <circle cx="7" cy="17" r="2" />
                <circle cx="18" cy="17" r="2" />
                <path d="M9 17h7M3 17h2M20 17h1" />
              </svg>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">
                  Fleet assignment
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] text-slate-500">
                  Optional
                </span>
              </div>
              <h2 className="mt-1 text-[15px] font-black tracking-[-.015em] text-[#0a1d3e]">
                {activeFleet ? `Linked to ${activeFleet.fleet_name}` : "Individual vehicle / Fleet vehicle"}
              </h2>
              <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                Use only for transporters, taxi operators, school buses or other multi-vehicle customers.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:min-w-[560px] lg:justify-end">
            <div className="relative min-w-0 flex-1 lg:max-w-[420px]">
              <select
                aria-label="Select fleet"
                value={selected}
                onChange={(event) => choose(event.target.value)}
                className="h-12 w-full appearance-none rounded-[14px] border border-slate-200 bg-[#f7faff] pl-4 pr-11 text-sm font-bold text-slate-800 outline-none transition hover:border-blue-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="">No fleet — individual vehicle</option>
                {rows.map((fleet) => (
                  <option key={fleet.id} value={fleet.id}>
                    {fleet.fleet_name} · {fleet.fleet_code} · {fleet.vehicle_count} vehicles
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m7 10 5 5 5-5" />
              </svg>
            </div>

            <Link
              href="/fleets"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[14px] border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19V8l8-4 8 4v11" />
                <path d="M8 19v-5h8v5M8 9h.01M12 9h.01M16 9h.01" />
              </svg>
              Manage Fleets
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
