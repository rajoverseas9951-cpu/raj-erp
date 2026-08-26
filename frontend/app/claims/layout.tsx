import { ReactNode, Suspense } from "react";

export default function ClaimsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4f7fb] p-6 text-sm font-semibold text-slate-500">Loading claims…</div>}>
      {children}
    </Suspense>
  );
}
