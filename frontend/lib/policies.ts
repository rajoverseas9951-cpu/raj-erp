"use client";

import { authenticatedRequest } from "@/lib/api-client";

export type PolicyRow = {
  id:string; vehicle_id:string; vehicle_number:string; policy_number:string; company_name:string;
  insurance_type:string; status:string; issue_date:string; expiry_date:string; gross_premium:number;
  gross_commission:number; agent_commission:number; tds_amount?:number; net_receivable?:number; received_amount?:number;
  first_name?:string; last_name?:string;
  archived_at?:string;
};
export type PolicyPage = { data:PolicyRow[]; current_page:number; last_page:number; per_page:number; total:number };
export type PolicyReportSummary = { policy_count:number; gross_premium:number; gross_commission:number; agent_commission:number; tds:number; commission_received:number; commission_outstanding:number };

export const policyApi = {
  list: (query:URLSearchParams) => authenticatedRequest<PolicyPage>(`/policies?${query.toString()}`),
  get: (id:string) => authenticatedRequest<PolicyRow>(`/policies/${id}`),
  summary: () => authenticatedRequest<PolicyReportSummary>("/reports/policies/summary"),
};
