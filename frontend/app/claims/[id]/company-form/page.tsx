"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { authenticatedRequest } from "@/lib/api-client";
import { resolveInsurer } from "@/lib/claim-form-registry";

type Claim = { insurance_company?: string | null; insurance_line?: string | null };

function isMotor(value?: string | null) {
  const n = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return !n.includes("non motor") && n.includes("motor");
}

export default function CompanyClaimFormRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id || "");

  useEffect(() => {
    if (!id) return;
    authenticatedRequest<Claim>(`/claims/${id}`)
      .then((claim) => {
        const insurer = resolveInsurer(claim.insurance_company);
        if (insurer.key === "bajaj" && isMotor(claim.insurance_line)) {
          router.replace(`/claims/official-form/bajaj-motor?id=${encodeURIComponent(id)}`);
          return;
        }
        router.replace(`/claims/official-form?id=${encodeURIComponent(id)}`);
      })
      .catch(() => router.replace(`/claims/official-form?id=${encodeURIComponent(id)}`));
  }, [id, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#e9eef5] p-6 text-slate-700">
      <div className="rounded-2xl bg-white px-6 py-5 text-sm font-bold shadow-sm">Opening claim form…</div>
    </main>
  );
}
