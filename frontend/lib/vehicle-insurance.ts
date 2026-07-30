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
  gst_other_charges: number;
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
  create: (vehicleId: string, body: unknown) => request<VehicleInsurancePolicy>(`/vehicles/${vehicleId}/insurances`, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  update: (vehicleId: string, policyId: string, body: unknown) => request<VehicleInsurancePolicy>(`/vehicles/${vehicleId}/insurances/${policyId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }),
  remove: (vehicleId: string, policyId: string) => request<null>(`/vehicles/${vehicleId}/insurances/${policyId}`, {
    method: 'DELETE',
  }),
};
