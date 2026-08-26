"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authenticatedRequest } from "@/lib/api-client";
import { getOfficialClaimSource, resolveClaimLine, resolveInsurer } from "@/lib/claim-form-registry";

type ClaimMeta = {
  id: string;
  insurance_line?: string | null;
  insurance_company?: string | null;
};

export default function UniversalFormLayout({ children }: { children: React.ReactNode }) {
  const search = useSearchParams();
  const id = search.get("id") || "";
  const [claim, setClaim] = useState<ClaimMeta | null>(null);

  useEffect(() => {
    if (!id) return;
    void authenticatedRequest<ClaimMeta>(`/claims/${id}`).then(setClaim).catch(() => setClaim(null));
  }, [id]);

  const insurer = resolveInsurer(claim?.insurance_company);
  const line = resolveClaimLine(claim?.insurance_line);
  const source = getOfficialClaimSource(claim?.insurance_company, claim?.insurance_line);

  return (
    <>
      {claim ? (
        <div className="no-print border-b border-slate-200 bg-white px-4 py-2.5 text-slate-900 shadow-sm">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${source ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {source ? "Official form verified" : "Universal fallback"}
                </span>
                <span className="text-[11px] font-bold text-slate-500">{insurer.displayName} · {line.replaceAll("_", " ")}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {source ? "Official insurer source mapped. Use it to cross-check the final submission form." : "Official insurer source for this exact line is not yet verified; autofill/manual workflow remains available."}
              </p>
            </div>
            {source ? (
              <a href={source.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700">
                Open Original Insurer Form ↗
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
}
