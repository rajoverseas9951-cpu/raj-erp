"use client";
import { authenticatedAction, authenticatedRequest } from "@/lib/api-client";

export type UserProfile = {
  id: string; tenant_id: string; name: string; email: string; phone: string | null;
  profile_photo_url: string | null; role: string | null;
  organization?: { id: string; name: string; brand_name: string | null };
};

export const profileApi = {
  get: () => authenticatedRequest<UserProfile>("/profile"),
  update: (body: FormData) => authenticatedRequest<UserProfile>("/profile", { method: "POST", body }),
  changePassword: (body: {current_password:string;password:string;password_confirmation:string}) =>
    authenticatedAction("/auth/password", { method: "PUT", body: JSON.stringify(body) }),
};
