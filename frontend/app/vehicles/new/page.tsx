import { VehicleForm } from "@/components/vehicles/VehicleForm";

export default function AddVehiclePage() {
  return (
    <main className="vehicle-onboarding min-h-screen px-3 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <VehicleForm />
      </div>

      <style>{`
        .vehicle-onboarding {
          background:
            linear-gradient(rgba(255,255,255,.86),rgba(255,255,255,.86)),
            radial-gradient(circle at 10% 0%,#bfdbfe 0,transparent 32%),
            radial-gradient(circle at 100% 8%,#dbeafe 0,transparent 30%),
            #edf3fb;
        }

        .vehicle-onboarding form { gap: 24px; }

        /* HERO */
        .vehicle-onboarding form > section:first-child {
          overflow: visible !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .vehicle-onboarding form > section:first-child > div:first-child {
          min-height: 270px;
          border-radius: 32px !important;
          padding: 38px 42px !important;
          background:
            radial-gradient(circle at 88% 15%,rgba(56,189,248,.32),transparent 23%),
            radial-gradient(circle at 78% 110%,rgba(37,99,235,.65),transparent 38%),
            linear-gradient(125deg,#031329 0%,#09285a 56%,#0f4bb8 100%) !important;
          box-shadow: 0 30px 80px rgba(10,31,75,.24) !important;
        }
        .vehicle-onboarding form > section:first-child h1 {
          max-width: 680px;
          font-size: clamp(34px,4vw,54px) !important;
          line-height: .98 !important;
          letter-spacing: -.055em !important;
        }
        .vehicle-onboarding form > section:first-child h1::after {
          content: "Fast. Accurate. Organized.";
          display: block;
          margin-top: 16px;
          font-size: 11px;
          line-height: 1;
          letter-spacing: .22em;
          text-transform: uppercase;
          color: #7dd3fc;
        }

        /* STEP RAIL */
        .vehicle-onboarding form > section:first-child nav {
          position: relative;
          z-index: 3;
          width: calc(100% - 48px);
          margin: -26px auto 0 !important;
          padding: 10px !important;
          gap: 8px !important;
          border: 1px solid #dbe6f3 !important;
          border-radius: 22px !important;
          background: rgba(255,255,255,.96) !important;
          box-shadow: 0 18px 45px rgba(17,45,92,.12) !important;
          backdrop-filter: blur(16px);
        }
        .vehicle-onboarding form > section:first-child nav a {
          min-height: 64px;
          padding: 10px 14px !important;
          border: 0 !important;
          border-radius: 16px !important;
          background: transparent !important;
          color: #526079 !important;
        }
        .vehicle-onboarding form > section:first-child nav a:hover {
          transform: translateY(-2px);
          background: #eef5ff !important;
          color: #123f91 !important;
        }
        .vehicle-onboarding form > section:first-child nav a span {
          width: 34px !important;
          height: 34px !important;
          border-radius: 11px !important;
          background: linear-gradient(145deg,#0b2f6b,#2563eb) !important;
          box-shadow: 0 8px 18px rgba(37,99,235,.22);
        }

        /* RC / MANUAL CHOICE */
        .vehicle-onboarding form > section:first-child > div:nth-of-type(2) {
          margin-top: 18px;
          padding: 0 !important;
          gap: 14px !important;
        }
        .vehicle-onboarding form > section:first-child > div:nth-of-type(2) button {
          position: relative;
          min-height: 160px;
          padding: 24px !important;
          border: 1px solid #dce7f4 !important;
          border-radius: 26px !important;
          background: linear-gradient(145deg,#fff,#f8fbff) !important;
          box-shadow: 0 16px 38px rgba(20,53,102,.08) !important;
        }
        .vehicle-onboarding form > section:first-child > div:nth-of-type(2) button::after {
          content: "SELECT";
          position: absolute;
          top: 18px;
          right: 18px;
          padding: 6px 9px;
          border-radius: 999px;
          background: #eff6ff;
          color: #2563eb;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .15em;
        }
        .vehicle-onboarding form > section:first-child > div:nth-of-type(2) button[aria-pressed="true"] {
          border-color: #60a5fa !important;
          background: linear-gradient(145deg,#f8fbff,#edf5ff) !important;
          box-shadow: 0 20px 46px rgba(37,99,235,.16), inset 0 0 0 2px rgba(59,130,246,.08) !important;
        }
        .vehicle-onboarding form > section:first-child > div:nth-of-type(2) button[aria-pressed="true"]::after {
          content: "ACTIVE";
          color: #047857;
          background: #ecfdf5;
        }

        /* MAIN FORM CARDS */
        .vehicle-onboarding form > div[id^="vehicle-step-"] > section {
          position: relative;
          overflow: hidden;
          border: 1px solid #dbe6f3 !important;
          border-radius: 30px !important;
          padding: 0 26px 28px !important;
          background: #fff !important;
          box-shadow: 0 18px 48px rgba(15,23,42,.065) !important;
        }
        .vehicle-onboarding form > div[id^="vehicle-step-"] h2 {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 0 -26px 26px !important;
          padding: 22px 26px !important;
          border-bottom: 1px solid #e6edf6 !important;
          background: linear-gradient(90deg,#f7faff 0%,#fff 60%) !important;
          color: #0a1d3e !important;
          font-size: 21px !important;
          letter-spacing: -.025em;
        }
        .vehicle-onboarding form > div[id^="vehicle-step-"] h2::before {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          border-radius: 13px;
          color: #fff;
          background: linear-gradient(145deg,#0b2f6b,#2563eb);
          box-shadow: 0 9px 20px rgba(37,99,235,.20);
          font-size: 13px;
          font-weight: 900;
        }
        .vehicle-onboarding #vehicle-step-1 h2::before { content:"01"; }
        .vehicle-onboarding #vehicle-step-2 h2::before { content:"02"; }
        .vehicle-onboarding #vehicle-step-3 h2::before { content:"03"; }
        .vehicle-onboarding #vehicle-step-4 h2::before { content:"04"; }

        /* FIELDS */
        .vehicle-onboarding form > div[id^="vehicle-step-"] label {
          display: block;
          padding: 4px;
          border-radius: 16px;
          color: #42516a !important;
          font-size: 12px !important;
          font-weight: 800 !important;
          letter-spacing: .01em;
        }
        .vehicle-onboarding form input,
        .vehicle-onboarding form select {
          min-height: 52px;
          border: 1px solid #d7e2ef !important;
          border-radius: 15px !important;
          background-color: #f7faff !important;
          color: #071a3b !important;
          font-size: 14px !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
          transition: .18s ease !important;
        }
        .vehicle-onboarding form input:hover,
        .vehicle-onboarding form select:hover {
          border-color: #9ebbe4 !important;
          background: #fff !important;
        }
        .vehicle-onboarding form input:focus,
        .vehicle-onboarding form select:focus {
          transform: translateY(-1px);
          border-color: #3b82f6 !important;
          background: #fff !important;
          box-shadow: 0 0 0 4px rgba(59,130,246,.10),0 10px 24px rgba(37,99,235,.08) !important;
        }
        .vehicle-onboarding form a[href="/customers/new"] {
          padding: 7px 11px;
          border-radius: 10px;
          background: #edf5ff;
          color: #1752b5 !important;
        }

        /* COMPLIANCE */
        .vehicle-onboarding #vehicle-step-4 > section > div > div {
          min-height: 132px;
          padding: 16px !important;
          border: 1px solid #dce7f4 !important;
          border-radius: 20px !important;
          background: linear-gradient(145deg,#fff,#f7fbff) !important;
          box-shadow: 0 10px 24px rgba(15,23,42,.04);
        }

        /* SAVE BAR */
        .vehicle-onboarding form > div.fixed {
          left: 0 !important;
          padding: 13px max(16px,calc((100vw - 1500px)/2 + 26px)) !important;
          border-top: 1px solid rgba(191,205,223,.8) !important;
          background: rgba(247,250,255,.90) !important;
          box-shadow: 0 -18px 46px rgba(15,23,42,.09) !important;
          backdrop-filter: blur(20px) saturate(160%) !important;
        }
        .vehicle-onboarding form > div.fixed > div {
          max-width: 1500px;
          margin: auto;
          align-items: center;
        }
        .vehicle-onboarding form > div.fixed button {
          min-width: 230px;
          min-height: 54px;
          border-radius: 16px !important;
          background: linear-gradient(90deg,#082654,#1767db) !important;
          box-shadow: 0 14px 32px rgba(26,83,181,.30) !important;
          font-size: 15px !important;
          letter-spacing: .01em;
        }
        .vehicle-onboarding form > div.fixed button::before { content:"✓  "; }
        .vehicle-onboarding form > div.fixed button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 18px 40px rgba(26,83,181,.36) !important;
        }

        @media (max-width: 767px) {
          .vehicle-onboarding form > section:first-child > div:first-child {
            min-height: 0;
            padding: 26px 20px 42px !important;
            border-radius: 26px !important;
          }
          .vehicle-onboarding form > section:first-child nav {
            width: calc(100% - 18px);
            margin-top: -20px !important;
            grid-template-columns: 1fr 1fr !important;
          }
          .vehicle-onboarding form > section:first-child nav a {
            min-height: 56px;
            padding: 8px !important;
            font-size: 10px !important;
          }
          .vehicle-onboarding form > section:first-child nav a span {
            width: 28px !important;
            height: 28px !important;
          }
          .vehicle-onboarding form > section:first-child > div:nth-of-type(2) button {
            min-height: 132px;
            border-radius: 22px !important;
          }
          .vehicle-onboarding form > div[id^="vehicle-step-"] > section {
            padding: 0 16px 20px !important;
            border-radius: 24px !important;
          }
          .vehicle-onboarding form > div[id^="vehicle-step-"] h2 {
            margin: 0 -16px 20px !important;
            padding: 16px !important;
            font-size: 18px !important;
          }
          .vehicle-onboarding form > div[id^="vehicle-step-"] h2::before {
            width: 34px;
            height: 34px;
            flex-basis: 34px;
            border-radius: 11px;
            font-size: 11px;
          }
          .vehicle-onboarding form input,
          .vehicle-onboarding form select { min-height: 48px; }
          .vehicle-onboarding form > div.fixed { padding: 10px 12px !important; }
          .vehicle-onboarding form > div.fixed button { width: 100%; min-width: 0; }
        }
      `}</style>
    </main>
  );
}
