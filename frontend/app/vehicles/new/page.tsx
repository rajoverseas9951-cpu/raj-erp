import { VehicleForm } from "@/components/vehicles/VehicleForm";

export default function AddVehiclePage() {
  return (
    <main className="vehicle-onboarding min-h-screen bg-[#eef4fb] px-3 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px]">
        <VehicleForm />
      </div>

      <style>{`
        .vehicle-onboarding {
          background:
            radial-gradient(circle at 12% 0%, rgba(37, 99, 235, .08), transparent 28%),
            radial-gradient(circle at 88% 8%, rgba(34, 211, 238, .07), transparent 24%),
            #eef4fb;
        }

        .vehicle-onboarding form > section:first-child {
          border-radius: 30px !important;
          border-color: rgba(148, 163, 184, .18) !important;
          box-shadow: 0 24px 70px rgba(15, 23, 42, .13) !important;
        }

        .vehicle-onboarding form > section:first-child > div:first-child {
          min-height: 230px;
          padding: 34px 38px !important;
          background:
            radial-gradient(circle at 82% 18%, rgba(53, 180, 255, .30), transparent 28%),
            radial-gradient(circle at 95% 90%, rgba(37, 99, 235, .45), transparent 30%),
            linear-gradient(125deg, #061225 0%, #0a2147 46%, #123f91 100%) !important;
        }

        .vehicle-onboarding form > section:first-child h1 {
          letter-spacing: -.045em !important;
          text-shadow: 0 10px 35px rgba(0, 0, 0, .18);
        }

        .vehicle-onboarding form > section:first-child nav {
          gap: 10px !important;
          padding: 14px 18px !important;
          background: rgba(255,255,255,.96) !important;
        }

        .vehicle-onboarding form > section:first-child nav a {
          min-height: 52px;
          border-radius: 15px !important;
          border-color: #e4ebf5 !important;
          background: #f8fbff !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
        }

        .vehicle-onboarding form > section:first-child nav a:hover {
          transform: translateY(-1px);
          border-color: #93c5fd !important;
          box-shadow: 0 8px 22px rgba(37, 99, 235, .09);
        }

        .vehicle-onboarding form > section:first-child nav a span {
          box-shadow: 0 5px 14px rgba(15, 23, 42, .18);
        }

        .vehicle-onboarding form > section:first-child > div:nth-of-type(2) button {
          min-height: 132px;
          border-radius: 22px !important;
          border-color: #dbe7f6 !important;
          background: linear-gradient(145deg, #ffffff, #f7fbff) !important;
          box-shadow: 0 10px 30px rgba(30, 64, 175, .06);
        }

        .vehicle-onboarding form > section:first-child > div:nth-of-type(2) button[aria-pressed="true"] {
          border-color: #60a5fa !important;
          background: linear-gradient(145deg, #f8fbff, #edf5ff) !important;
          box-shadow: 0 14px 36px rgba(37, 99, 235, .12), inset 0 0 0 1px rgba(59,130,246,.08) !important;
        }

        .vehicle-onboarding form > div[id^="vehicle-step-"] > section {
          position: relative;
          overflow: hidden;
          border-radius: 26px !important;
          border-color: #dce6f3 !important;
          padding: 24px !important;
          box-shadow: 0 14px 40px rgba(15, 23, 42, .055) !important;
        }

        .vehicle-onboarding form > div[id^="vehicle-step-"] > section::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
          background: linear-gradient(#2563eb, #38bdf8);
          opacity: .9;
        }

        .vehicle-onboarding form > div[id^="vehicle-step-"] h2 {
          margin: -24px -24px 22px !important;
          padding: 20px 24px 18px 28px !important;
          border-bottom: 1px solid #e9eff7 !important;
          background: linear-gradient(90deg, #fbfdff, #f4f8ff) !important;
          font-size: 20px !important;
          letter-spacing: -.025em;
        }

        .vehicle-onboarding form > div[id^="vehicle-step-"] label {
          color: #334155 !important;
          font-weight: 750 !important;
        }

        .vehicle-onboarding form input,
        .vehicle-onboarding form select {
          min-height: 48px;
          border-radius: 14px !important;
          border: 1px solid #dbe5f1 !important;
          background-color: #f9fbfe !important;
          color: #0f172a !important;
          transition: border-color .18s ease, box-shadow .18s ease, background .18s ease, transform .18s ease;
        }

        .vehicle-onboarding form input:hover,
        .vehicle-onboarding form select:hover {
          border-color: #b8cbea !important;
          background-color: #fff !important;
        }

        .vehicle-onboarding form input:focus,
        .vehicle-onboarding form select:focus {
          border-color: #3b82f6 !important;
          background-color: #fff !important;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, .10), 0 7px 18px rgba(37, 99, 235, .08) !important;
        }

        .vehicle-onboarding form a[href="/customers/new"] {
          border-radius: 10px;
          padding: 6px 10px;
          background: #eff6ff;
          color: #1d4ed8 !important;
        }

        .vehicle-onboarding form > div[id="vehicle-step-4"] > section > div > div {
          border-radius: 18px !important;
          border-color: #dce7f4 !important;
          background: linear-gradient(145deg, #ffffff, #f8fbff) !important;
          padding: 14px !important;
        }

        .vehicle-onboarding form > div.fixed {
          left: 0 !important;
          padding: 12px max(16px, calc((100vw - 1480px)/2 + 24px)) !important;
          border-top: 1px solid rgba(203, 213, 225, .72) !important;
          background: rgba(246, 249, 253, .88) !important;
          box-shadow: 0 -12px 36px rgba(15, 23, 42, .08);
          backdrop-filter: blur(18px) saturate(150%) !important;
        }

        .vehicle-onboarding form > div.fixed > div {
          max-width: 1480px;
          margin-left: auto;
          margin-right: auto;
        }

        .vehicle-onboarding form > div.fixed button {
          min-width: 190px;
          min-height: 50px;
          border-radius: 15px !important;
          background: linear-gradient(90deg, #0b2c63, #2563eb) !important;
          box-shadow: 0 12px 28px rgba(37, 99, 235, .24) !important;
          transition: transform .18s ease, box-shadow .18s ease;
        }

        .vehicle-onboarding form > div.fixed button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 16px 34px rgba(37, 99, 235, .30) !important;
        }

        @media (max-width: 767px) {
          .vehicle-onboarding form > section:first-child > div:first-child {
            min-height: 0;
            padding: 24px 20px !important;
          }
          .vehicle-onboarding form > div[id^="vehicle-step-"] > section {
            padding: 18px !important;
            border-radius: 22px !important;
          }
          .vehicle-onboarding form > div[id^="vehicle-step-"] h2 {
            margin: -18px -18px 18px !important;
            padding: 17px 18px 15px 22px !important;
          }
          .vehicle-onboarding form > div.fixed {
            padding: 10px 12px !important;
          }
        }
      `}</style>
    </main>
  );
}
