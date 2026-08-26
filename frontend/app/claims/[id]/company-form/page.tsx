"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function LegacyCompanyClaimFormRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id || "");

  useEffect(() => {
    if (id) router.replace(`/claims/company-form?id=${encodeURIComponent(id)}`);
  }, [id, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#e9eef5] p-6 text-slate-700">
      <div className="rounded-2xl bg-white px-6 py-5 text-sm font-bold shadow-sm">
        Opening insurer claim form…
      </div>
    </main>
  );
}
