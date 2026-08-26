"use client";
import { authenticatedRequest } from "@/lib/api-client";

export type OrganizationModule = { key: string; allowed: boolean; enabled: boolean };

export type Organization = {
  id: string;
  name: string;
  brand_name: string | null;
  tagline: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pin_code: string | null;
  phone: string | null;
  email: string | null;
  gst_number: string | null;
  logo_url: string | null;
  modules?: OrganizationModule[];
};

export const organizationApi = {
  get: () => authenticatedRequest<Organization>("/organization"),
  update: (body: FormData) => authenticatedRequest<Organization>("/organization", { method: "POST", body }),
  updateModule: (moduleKey: string, enabled: boolean) => {
    const body = new FormData();
    body.set("module_key", moduleKey);
    body.set("is_enabled", enabled ? "1" : "0");
    return authenticatedRequest<Organization>("/organization", { method: "POST", body });
  },
};
