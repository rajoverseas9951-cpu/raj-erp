import { CustomerForm } from '@/components/customers/CustomerForm';

export default function AddCustomerPage() {
  return (
    <main className="customer-onboarding min-h-screen bg-[linear-gradient(180deg,#f5f8fd_0%,#eef4fb_100%)] px-3 py-4 sm:px-5 sm:py-6 lg:px-7">
      <CustomerForm />

      <style>{`
        .customer-onboarding form > div.sticky {
          position: fixed !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          z-index: 30 !important;
          margin: 0 !important;
          border: 0 !important;
          border-top: 1px solid rgba(191,205,223,.82) !important;
          border-radius: 0 !important;
          background: rgba(247,250,255,.92) !important;
          box-shadow: 0 -18px 46px rgba(15,23,42,.09) !important;
          backdrop-filter: blur(20px) saturate(160%) !important;
          padding: 13px max(16px,calc((100vw - 1500px)/2 + 26px)) !important;
          justify-content: flex-end !important;
        }

        .customer-onboarding form > div.sticky > div:first-child {
          display: none !important;
        }

        .customer-onboarding form > div.sticky > div:last-child {
          width: 100% !important;
          display: flex !important;
          justify-content: flex-end !important;
          gap: 12px !important;
        }

        .customer-onboarding form > div.sticky button {
          min-height: 48px !important;
          border-radius: 12px !important;
          font-size: 14px !important;
          font-weight: 800 !important;
        }

        .customer-onboarding form > div.sticky button[type="button"] {
          min-width: 110px !important;
          border: 1px solid #d7e2ef !important;
          background: #fff !important;
          color: #55657c !important;
          box-shadow: none !important;
        }

        .customer-onboarding form > div.sticky button:not([type="button"]) {
          min-width: 190px !important;
          background: linear-gradient(90deg,#2563eb,#4f46e5) !important;
          color: #fff !important;
          box-shadow: 0 12px 24px rgba(37,99,235,.2) !important;
        }

        @media (min-width: 1024px) {
          .customer-onboarding form > div.sticky {
            left: 260px !important;
          }
        }

        @media (max-width: 639px) {
          .customer-onboarding form > div.sticky > div:last-child {
            display: grid !important;
            grid-template-columns: 1fr 1.5fr !important;
          }
          .customer-onboarding form > div.sticky button {
            min-width: 0 !important;
          }
        }
      `}</style>
    </main>
  );
}
