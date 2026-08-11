import type { ReactNode } from "react";
import { Suspense } from "react";
import VehicleBrokerAgentBridge from "@/components/vehicles/VehicleBrokerAgentBridge";
import { ComplianceExpiryEnhancer } from "@/components/vehicles/ComplianceExpiryEnhancer";
import { InlineCustomerCreator } from "@/components/vehicles/InlineCustomerCreator";
import { FleetVehiclePicker } from "@/components/fleets/FleetVehiclePicker";

export default function NewVehicleLayout({ children }: { children: ReactNode }) {
  return (
    <div className="vehicle-new-footer-sync">
      <Suspense fallback={null}><FleetVehiclePicker /></Suspense>
      {children}
      <VehicleBrokerAgentBridge />
      <ComplianceExpiryEnhancer />
      <InlineCustomerCreator />
      <style>{`
        .vehicle-new-footer-sync .vehicle-onboarding form > div.fixed {
          position: sticky !important;
          bottom: 12px !important;
          left: auto !important;
          right: auto !important;
          width: 100% !important;
          z-index: 40 !important;
          display: flex !important;
          justify-content: flex-end !important;
          margin: 8px auto 0 !important;
          padding: 12px !important;
          border: 1px solid #dbe5f2 !important;
          border-radius: 22px !important;
          background: rgba(255,255,255,.95) !important;
          box-shadow: 0 18px 50px rgba(7,26,60,.18) !important;
          backdrop-filter: blur(20px) saturate(160%) !important;
        }
        .vehicle-new-footer-sync .vehicle-onboarding form > div.fixed > div {
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 8px !important;
        }
        .vehicle-new-footer-sync .vehicle-onboarding form > div.fixed a {
          min-height: 48px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 20px !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 16px !important;
          background: #fff !important;
          color: #475569 !important;
          font-size: 14px !important;
          font-weight: 800 !important;
          box-shadow: none !important;
        }
        .vehicle-new-footer-sync .vehicle-onboarding form > div.fixed button[type="submit"],
        .vehicle-new-footer-sync .vehicle-onboarding form > div.fixed button:not([type="button"]) {
          min-width: 180px !important;
          min-height: 48px !important;
          padding: 0 24px !important;
          border: 0 !important;
          border-radius: 16px !important;
          background: linear-gradient(90deg,#0b2f6b,#2563eb) !important;
          color: #fff !important;
          font-size: 14px !important;
          font-weight: 900 !important;
          box-shadow: 0 12px 28px rgba(37,99,235,.28) !important;
        }
        @media (max-width: 640px) {
          .vehicle-new-footer-sync .vehicle-onboarding form > div.fixed {
            bottom: 8px !important;
            border-radius: 18px !important;
            padding: 9px !important;
          }
          .vehicle-new-footer-sync .vehicle-onboarding form > div.fixed > div { gap: 7px !important; }
          .vehicle-new-footer-sync .vehicle-onboarding form > div.fixed a {
            min-height: 44px !important;
            padding: 0 14px !important;
            font-size: 13px !important;
          }
          .vehicle-new-footer-sync .vehicle-onboarding form > div.fixed button[type="submit"],
          .vehicle-new-footer-sync .vehicle-onboarding form > div.fixed button:not([type="button"]) {
            min-width: 150px !important;
            min-height: 44px !important;
            padding: 0 18px !important;
            font-size: 13px !important;
          }
        }
      `}</style>
    </div>
  );
}
