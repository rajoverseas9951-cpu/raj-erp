import { authenticatedRequest } from '@/lib/api-client';
import { invalidateDashboard } from '@/lib/dashboard-refresh';

export type VehicleInsurancePolicy = {
  id: string;
  vehicle_id: string;
  insurance_company_id?: string;
  company_name: string;
  company_code?: string;
  purchase_from: string;
  policy_number: string;
  policy_date?: string;
  issue_date: string;
  expiry_date: string;
  status: string;
  insurance_type: string;
  remark?: string;
  od_premium: number;
  tp_premium: number;
  addon_premium: number;
  net_premium: number;
  has_od_cover: boolean;
  has_tp_cover: boolean;
  commission_on_od: boolean;
  commission_on_tp: boolean;
  commission_on_net: boolean;
  commission_on_addon: boolean;
  od_commission_percent: number;
  tp_commission_percent: number;
  od_commission_amount: number;
  tp_commission_amount: number;
  long_term_tp_policy_number?: string;
  long_term_tp_expiry?: string;
  policy_document_file_id?: string;
  purchase_from_type?: 'direct_company'|'agent';
  purchase_source_id?: string;
  commission_receivable_from_type?: string;
  commission_receivable_from_id?: string;
  commission_basis?: 'OD_PREMIUM'|'NET_PREMIUM'|'MANUAL';
  gst_other_charges: number;
  gst_percent: number;
  gst_amount: number;
  gst_mode?: 'single_rate'|'mixed_goods_carriage';
  od_addon_gst_percent?: number;
  tp_gst_percent?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  tp_gst_amount?: number;
  od_addon_gst_amount?: number;
  other_charges: number;
  gross_premium: number;
  commission_percent: number;
  gross_commission: number;
  customer_discount: number;
  customer_pay: number;
  agent?: string;
  agent_commission: number;
  payment_details?: Record<string, unknown>;
  created_at: string;
  archived_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
};

export type InsuranceCalculation = {
  has_od_cover: boolean;
  has_tp_cover: boolean;
  od_premium: number;
  tp_premium: number;
  addon_premium: number;
  net_premium: number;
  gst_percent: number;
  gst_amount: number;
  gst_mode?: 'single_rate'|'mixed_goods_carriage';
  od_addon_gst_percent?: number;
  tp_gst_percent?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  tp_gst_amount?: number;
  od_addon_gst_amount?: number;
  other_charges: number;
  gross_premium: number;
  customer_discount: number;
  customer_pay: number;
  commission_basis: 'OD_PREMIUM'|'NET_PREMIUM'|'MANUAL';
  commission_base: number;
  commission_percent: number;
  gross_commission: number;
};

function notifyPolicySaved(vehicleId:string, policyId:string){
  if(typeof window!=='undefined') window.dispatchEvent(new CustomEvent('raj:policy-saved',{detail:{vehicleId,policyId}}));
}

async function multipart<T>(path: string, body: FormData): Promise<T> {
  const result = await authenticatedRequest<T>(path, { method: 'POST', body });
  invalidateDashboard();
  return result;
}

async function request<T>(path: string, init?: RequestInit, invalidate = false): Promise<T> {
  const result = await authenticatedRequest<T>(path, init);
  if (invalidate) invalidateDashboard();
  return result;
}

export const vehicleInsuranceApi = {
  list: (vehicleId: string) => request<VehicleInsurancePolicy[]>(`/vehicles/${vehicleId}/insurances`),
  calculate: (vehicleId: string, body: unknown) => request<InsuranceCalculation>(`/vehicles/${vehicleId}/insurance-calculation`, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  create: async (vehicleId: string, body: unknown) => {
    const result=await request<VehicleInsurancePolicy>(`/vehicles/${vehicleId}/insurances`, {method:'POST',body:JSON.stringify(body)}, true);
    notifyPolicySaved(vehicleId,result.id);return result;
  },
  saveForm: async (vehicleId: string, body: FormData, policyId?: string) => {
    if (policyId) body.append('_method', 'PUT');
    const result=await multipart<VehicleInsurancePolicy>(`/vehicles/${vehicleId}/insurances${policyId ? `/${policyId}` : ''}`, body);
    notifyPolicySaved(vehicleId,result.id);return result;
  },
  update: async (vehicleId: string, policyId: string, body: unknown) => {
    const result=await request<VehicleInsurancePolicy>(`/vehicles/${vehicleId}/insurances/${policyId}`, {method:'PUT',body:JSON.stringify(body)}, true);
    notifyPolicySaved(vehicleId,result.id);return result;
  },
  remove: (vehicleId: string, policyId: string) => request<null>(`/vehicles/${vehicleId}/insurances/${policyId}`, {
    method: 'DELETE',
  }, true),
  archive: (vehicleId: string, policyId: string) => request<VehicleInsurancePolicy>(`/vehicles/${vehicleId}/insurances/${policyId}/archive`, {
    method: 'POST',
  }, true),
  cancel: (vehicleId: string, policyId: string, body: {cancellation_date:string;cancellation_reason:string;refund_amount:number;cancellation_charges:number;confirmed:boolean}) => request<VehicleInsurancePolicy>(`/vehicles/${vehicleId}/insurances/${policyId}/cancel`, {
    method: 'POST', body: JSON.stringify(body),
  }, true),
};
