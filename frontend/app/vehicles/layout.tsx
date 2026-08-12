import Link from "next/link";

export default function VehiclesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[1500px] items-center justify-end gap-2 px-4 pt-4 sm:px-6 lg:px-8">
        <Link
          href="/vehicles"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-black text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        >
          <span aria-hidden>←</span>
          Vehicles
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-[#0b2f6b] px-4 py-2.5 text-xs font-black text-white shadow-[0_8px_20px_rgba(11,47,107,.18)] transition hover:bg-[#123f89]"
        >
          <span aria-hidden>⌂</span>
          Dashboard
        </Link>
      </div>
      {children}
    </div>
  );
}
