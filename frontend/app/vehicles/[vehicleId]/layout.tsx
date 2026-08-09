'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { vehicleOperationsApi } from '@/lib/vehicle-operations';

type Props = { children: ReactNode };

export default function VehicleLayout({ children }: Props) {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const pathname = usePathname();
  const [eligible, setEligible] = useState(false);

  const profilePath = `/vehicles/${vehicleId}`;
  const isProfile = pathname === profilePath || pathname === `${profilePath}/`;

  useEffect(() => {
    if (!isProfile) {
      setEligible(false);
      return;
    }
    vehicleOperationsApi.profile(vehicleId)
      .then((profile) => {
        const c = profile.applicability.classification;
        setEligible(Boolean(c.privateCar || c.twoWheeler));
      })
      .catch(() => setEligible(false));
  }, [isProfile, vehicleId]);

  return (
    <>
      {children}
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
