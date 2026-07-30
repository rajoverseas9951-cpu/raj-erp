export type Customer = {
  id: string;
  customer_code: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  mobile: string;
  alternate_mobile?: string;
  whatsapp?: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  aadhaar_number?: string;
  pan_number?: string;
  driving_licence_number?: string;
  passport_number?: string;
  voter_id?: string;
  current_address?: string;
  permanent_address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  occupation?: string;
  company_name?: string;
  gst_number?: string;
  remarks?: string;
  tags?: string[];
  priority: string;
  status: string;
  vehicles_count: number;
  insurance_policies_count: number;
  rto_files_count: number;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined'
    ? sessionStorage.getItem('raj_erp_token')
    : null;

  const response = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  let payload: {
    data?: T;
    message?: string;
    error?: { message?: string };
    errors?: Record<string, string[]>;
  } = {};

  try {
    payload = await response.json();
  } catch {
    // Keep the status-based error below when Laravel returns HTML.
  }

  if (!response.ok) {
    const firstValidationError = payload.errors
      ? Object.values(payload.errors)[0]?.[0]
      : undefined;

    throw new Error(
      firstValidationError ??
      payload.message ??
      payload.error?.message ??
      `API request failed: ${response.status}`,
    );
  }

  return payload.data as T;
}

export const customerApi = {
  list: (q = '') => request<{ data: Customer[]; links: unknown; meta: unknown }>(`/customers${q}`),
  get: (id: string) => request<Customer>(`/customers/${id}`),
  timeline: (id: string) => request<{ data: TimelineEvent[] }>(`/customers/${id}/timeline`),
  create: (body: unknown) => request<Customer>('/customers', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: unknown) => request<Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  bulkDelete: (ids: string[]) => request('/customers/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  bulkAssign: (ids: string[], assigned_to: string) => request('/customers/bulk-assign', { method: 'POST', body: JSON.stringify({ ids, assigned_to }) }),
};

export type TimelineEvent = {
  id: string;
  event_type: string;
  title: string;
  description?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
};
