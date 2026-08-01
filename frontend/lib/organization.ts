"use client";
import { authenticatedRequest } from "@/lib/api-client";
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
};
export const organizationApi = {
  get: () => authenticatedRequest<Organization>("/organization"),
  update: (body: FormData) => authenticatedRequest<Organization>("/organization", { method: "POST", body }),
};
