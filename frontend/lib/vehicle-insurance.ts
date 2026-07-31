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
  other_charges: number;
  gross_premium: number;
  customer_discount: number;
  customer_pay: number;
  commission_basis: 'OD_PREMIUM'|'NET_PREMIUM'|'MANUAL';
  commission_base: number;
  commission_percent: number;
  gross_commission: number;
};

async function multipart<T>(path: string, body: FormData): Promise<T> {
  const token = sessionStorage.getItem('raj_erp_token');
  const response = await fetch(`${API}/api/v1${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body,
  });
  const payload = await response.json().catch(() => ({})) as { data?: T; message?: string; errors?: Record<string,string[]> };
  if (!response.ok) throw new Error(payload.errors ? Object.values(payload.errors)[0]?.[0] : payload.message ?? `Policy request failed: ${response.status}`);
  return payload.data as T;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem('raj_erp_token');
  const response = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({})) as {
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
  };

  if (!response.ok) {
    const validationError = payload.errors ? Object.values(payload.errors)[0]?.[0] : undefined;
    throw new Error(validationError ?? payload.message ?? `Policy request failed: ${response.status}`);
  }

  return payload.data as T;
}

export const vehicleInsuranceApi = {
  list: (vehicleId: string) => request<VehicleInsurancePolicy[]>(`/vehicles/${vehicleId}/insurances`),
  calculate: (vehicleId: string, body: unknown) => request<InsuranceCalculation>(`/vehicles/${vehicleId}/insurance-calculation`, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  create: (vehicleId: string, body: unknown) => request<VehicleInsurancePolicy>(`/vehicles/${vehicleId}/insurances`, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  saveForm: (vehicleId: string, body: FormData, policyId?: string) => {
    if (policyId) body.append('_method', 'PUT');
    return multipart<VehicleInsurancePolicy>(`/vehicles/${vehicleId}/insurances${policyId ? `/${policyId}` : ''}`, body);
  },
  update: (vehicleId: string, policyId: string, body: unknown) => request<VehicleInsurancePolicy>(`/vehicles/${vehicleId}/insurances/${policyId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }),
  remove: (vehicleId: string, policyId: string) => request<null>(`/vehicles/${vehicleId}/insurances/${policyId}`, {
    method: 'DELETE',
  }),
};
