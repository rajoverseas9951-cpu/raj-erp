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
            linear-gradient(rgba(255,255,255,.87),rgba(255,255,255,.87)),
            radial-gradient(circle at 8% 0%,#bfdbfe 0,transparent 30%),
            radial-gradient(circle at 100% 10%,#dbeafe 0,transparent 30%),
            #edf3fb;
        }

        .vehicle-onboarding form { gap: 24px; }

        .vehicle-onboarding form > section:first-child {
          overflow: visible !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .vehicle-onboarding form > section:first-child > div:first-child {
          min-height: 260px;
          border-radius: 32px !important;
          padding: 36px 40px !important;
          background:
            radial-gradient(circle at 88% 15%,rgba(56,189,248,.30),transparent 23%),
            radial-gradient(circle at 78% 110%,rgba(37,99,235,.62),transparent 38%),
            linear-gradient(125deg,#031329 0%,#09285a 56%,#0f4bb8 100%) !important;
          box-shadow: 0 30px 80px rgba(10,31,75,.23) !important;
        }
        .vehicle-onboarding form > section:first-child h1 {
          max-width: 680px;
          font-size: clamp(34px,4vw,54px) !important;
          line-height: .98 !important;
          letter-spacing: -.055em !important;
        }
        .vehicle-onboarding form > section:first-child h1::after {
          content: "Fast. Accurate. Renewal-ready.";
          display: block;
          margin-top: 16px;
          color: #7dd3fc;
          font-size: 10px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: .23em;
          text-transform: uppercase;
        }

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
          min-height: 62px;
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

        .vehicle-onboarding form > section:first-child > div:nth-of-type(2) {
          margin-top: 18px;
          padding: 0 !important;
          gap: 14px !important;
        }
        .vehicle-onboarding form > section:first-child > div:nth-of-type(2) button {
          position: relative;
          min-height: 145px;
          padding: 22px !important;
          border: 1px solid #dce7f4 !important;
          border-radius: 24px !important;
          background: linear-gradient(145deg,#fff,#f8fbff) !important;
          box-shadow: 0 16px 38px rgba(20,53,102,.07) !important;
        }
        .vehicle-onboarding form > section:first-child > div:nth-of-type(2) button[aria-pressed="true"] {
          border-color: #4f8ef7 !important;
          background: linear-gradient(145deg,#fafdff,#eef5ff) !important;
          box-shadow: 0 20px 46px rgba(37,99,235,.14),inset 0 0 0 2px rgba(59,130,246,.07) !important;
        }

        .vehicle-onboarding form > section:first-child > div:nth-of-type(3) {
          position: relative;
          margin-top: 16px;
          padding: 20px !important;
          gap: 16px !important;
          border: 1px solid #d9e5f4 !important;
          border-radius: 26px !important;
          background: linear-gradient(145deg,#ffffff,#f7fbff) !important;
          box-shadow: 0 18px 44px rgba(15,23,42,.065) !important;
        }

        .vehicle-onboarding form > div[id^="vehicle-step-"] > section {
          position: relative;
          overflow: hidden;
          border: 1px solid #dbe6f3 !important;
          border-radius: 28px !important;
          padding: 0 26px 28px !important;
          background: #fff !important;
          box-shadow: 0 18px 48px rgba(15,23,42,.06) !important;
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

        .vehicle-onboarding form > div[id^="vehicle-step-"] label {
          display: block;
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
          background-color: #fff !important;
        }
        .vehicle-onboarding form input:focus,
        .vehicle-onboarding form select:focus {
          transform: translateY(-1px);
          border-color: #3b82f6 !important;
          background-color: #fff !important;
          box-shadow: 0 0 0 4px rgba(59,130,246,.10),0 10px 24px rgba(37,99,235,.08) !important;
        }

        /* PREMIUM EXPIRY / RENEWAL CAPTURE */
        .vehicle-onboarding #vehicle-step-4 > section {
          background:
            radial-gradient(circle at 100% 0%,rgba(37,99,235,.07),transparent 30%),
            #fff !important;
        }
        .vehicle-onboarding #vehicle-step-4 > section > div {
          gap: 14px !important;
        }
        .vehicle-onboarding #vehicle-step-4 > section > div > div {
          position: relative;
          min-height: 178px;
          overflow: hidden;
          padding: 17px !important;
          border: 1px solid #d8e5f5 !important;
          border-radius: 22px !important;
          background:
            radial-gradient(circle at 100% 0%,rgba(59,130,246,.08),transparent 42%),
            linear-gradient(145deg,#fff,#f7fbff) !important;
          box-shadow: 0 12px 30px rgba(15,23,42,.045) !important;
          transition: .2s ease;
        }
        .vehicle-onboarding #vehicle-step-4 > section > div > div:hover {
          transform: translateY(-2px);
          border-color: #b5cdf0 !important;
          box-shadow: 0 18px 36px rgba(37,99,235,.09) !important;
        }
        .vehicle-onboarding #vehicle-step-4 > section > div > div::after {
          content: "RENEWAL TRACKING";
          position: absolute;
          top: 18px;
          right: 16px;
          padding: 5px 8px;
          border-radius: 999px;
          background: #edf5ff;
          color: #2c64bd;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .13em;
        }
        .vehicle-onboarding #vehicle-step-4 > section > div > div > p {
          margin: 0 0 14px !important;
          padding-right: 105px;
          color: #071c40 !important;
          font-size: 14px !important;
          font-weight: 900 !important;
        }
        .vehicle-onboarding #vehicle-step-4 select {
          min-height: 44px !important;
          margin-top: 0 !important;
          padding: 0 13px !important;
          border-radius: 12px !important;
          background-color: #fff !important;
          color: #40506a !important;
          font-size: 12px !important;
          font-weight: 750 !important;
        }
        .vehicle-onboarding #vehicle-step-4 input[type="date"] {
          position: relative;
          min-height: 56px !important;
          margin-top: 10px !important;
          padding: 0 14px 0 16px !important;
          border: 1px solid #bcd0ed !important;
          border-radius: 14px !important;
          background:
            linear-gradient(90deg,#ffffff 0%,#ffffff 76%,#edf5ff 76%,#edf5ff 100%) !important;
          color: #0a2147 !important;
          font-size: 14px !important;
          font-weight: 800 !important;
          letter-spacing: .02em;
          color-scheme: light;
        }
        .vehicle-onboarding #vehicle-step-4 input[type="date"]::-webkit-calendar-picker-indicator {
          width: 24px;
          height: 24px;
          padding: 9px;
          border-radius: 10px;
          cursor: pointer;
          opacity: .82;
        }
        .vehicle-onboarding #vehicle-step-4 input[type="date"]:focus {
          border-color: #2874e8 !important;
          box-shadow: 0 0 0 4px rgba(37,99,235,.10),0 12px 26px rgba(37,99,235,.09) !important;
        }
        .vehicle-onboarding #vehicle-step-4 h2::after {
          content: "Add existing expiry dates here so the ERP can follow upcoming renewals.";
          margin-left: auto;
          max-width: 430px;
          color: #728199;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.45;
          letter-spacing: 0;
          text-align: right;
        }

        .vehicle-onboarding form a[href="/customers/new"] {
          padding: 7px 11px;
          border-radius: 10px;
          background: #edf5ff;
          color: #1752b5 !important;
        }

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
        }
        .vehicle-onboarding form > div.fixed button::before { content:"✓  "; }

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
          .vehicle-onboarding form > div[id^="vehicle-step-"] > section {
            padding: 0 16px 20px !important;
            border-radius: 24px !important;
          }
          .vehicle-onboarding form > div[id^="vehicle-step-"] h2 {
            margin: 0 -16px 20px !important;
            padding: 16px !important;
            font-size: 18px !important;
          }
          .vehicle-onboarding #vehicle-step-4 h2::after { display:none; }
          .vehicle-onboarding #vehicle-step-4 > section > div > div {
            min-height: 165px;
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
