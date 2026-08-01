"use client";
import { authenticatedRequest } from "@/lib/api-client";
export type Organization = {
  id: string;
  name: string;
  brand_name: string | null;
  tagline: string | null;
  email: string | null;
};
export const organizationApi = {
  get: () => authenticatedRequest<Organization>("/organization"),
};
