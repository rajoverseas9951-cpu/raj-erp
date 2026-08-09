import Link from "next/link";

export default function VehiclesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="pointer-events-none fixed bottom-5 right-5 z-[80] sm:bottom-6 sm:right-6">
        <Link
          href="/dashboard"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl border border-[#d7e2f2] bg-white/95 px-4 py-3 text-sm font-black text-[#0b2b62] shadow-[0_14px_34px_rgba(11,43,98,.18)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50"
        >
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-[#0b2b62] to-[#2563eb] text-white shadow-sm">←</span>
          Dashboard
        </Link>
      </div>
      {children}
    </div>
  );
}
