export type VehicleCustomer = {
  id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  mobile: string;
};
export type Vehicle = {
  id: string;
  customer_id: string;
  customer?: VehicleCustomer;
  vehicle_number: string;
  manufacturer_id?: string;
  model_id?: string;
  colour_id?: string;
  vehicle_class_id?: string;
  vehicle_category_id?: string;
  fuel_type_id?: string;
  rto_office_id?: string;
  vehicle_type_id?: string;
  variant_id?: string;
  registration_date?: string;
  registration_valid_upto?: string;
  registration_authority?: string;
  state?: string;
  district?: string;
  vehicle_class?: string;
  vehicle_category?: string;
  vehicle_type?: string;
  manufacturer?: string;
  model?: string;
  variant?: string;
  manufacturing_year?: number;
  manufacturing_month?: number;
  colour?: string;
  fuel_type?: string;
  seating_capacity?: number;
  cubic_capacity?: number;
  gross_weight?: number;
  unladen_weight?: number;
  number_of_cylinders?: number;
  emission_norms?: string;
  horse_power?: number | string;
  wheel_base?: number;
  chassis_number: string;
  engine_number: string;
  hypothecation: boolean;
  financier?: string;
  broker_agent_enabled?: boolean;
  broker_name?: string;
  agent_name?: string;
  insurance_status: string;
  fitness_status: string;
  permit_status: string;
  tax_status: string;
  puc_status: string;
  insurance_expiry?: string;
  puc_expiry?: string;
  fitness_expiry?: string;
  permit_expiry?: string;
  national_permit_expiry?: string;
  tax_expiry?: string;
  counter_tax_expiry?: string;
  payment_due?: number | string;
  documents?: VehicleDocument[];
  archived_at?: string;
};
export type VehicleDocument = {
  id: string;
  document_type: string;
  file_name: string;
  file_id: string;
  created_at: string;
};
export type VehicleTimelineEvent = {
  id: string;
  event_type: string;
  title: string;
  description?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
};
export type VehiclePagination = { current_page: number; last_page: number; per_page: number; total: number };
export type VehicleListResponse = { data: Vehicle[]; links?: unknown; meta?: VehiclePagination; current_page?: number; last_page?: number; per_page?: number; total?: number };
export type VehicleBrokerAgentDraft = { broker_agent_enabled: boolean; broker_name: string; agent_name: string };

let brokerAgentDraft: VehicleBrokerAgentDraft | null = null;
export function setVehicleBrokerAgentDraft(draft: VehicleBrokerAgentDraft | null) { brokerAgentDraft = draft; }
function withBrokerAgentDraft(body: unknown) {
  if (!brokerAgentDraft || !body || typeof body !== 'object' || Array.isArray(body)) return body;
  return { ...(body as Record<string, unknown>), ...brokerAgentDraft };
}

async function mutateVehicle<T>(path: string, init: RequestInit): Promise<T> {
  const result = await authenticatedRequest<T>(path, init);
  invalidateDashboard();
  return result;
}
export const vehicleApi = {
  list: (q = "") =>
    authenticatedRequest<VehicleListResponse>(
      `/vehicles${q}`,
    ),
  get: (id: string) => authenticatedRequest<Vehicle>(`/vehicles/${id}`),
  timeline: (id: string) =>
    authenticatedRequest<{ data: VehicleTimelineEvent[] }>(
      `/vehicles/${id}/timeline`,
    ),
  create: (body: unknown) =>
    mutateVehicle<Vehicle>("/vehicles", {
      method: "POST",
      body: JSON.stringify(withBrokerAgentDraft(body)),
    }).finally(() => setVehicleBrokerAgentDraft(null)),
  update: (id: string, body: unknown) =>
    mutateVehicle<Vehicle>(`/vehicles/${id}`, {
      method: "PUT",
      body: JSON.stringify(withBrokerAgentDraft(body)),
    }).finally(() => setVehicleBrokerAgentDraft(null)),
  archive: (id: string) =>
    mutateVehicle<Vehicle>(`/vehicles/${id}/archive`, { method: "POST" }),
  remove: (id: string) =>
    mutateVehicle<null>(`/vehicles/${id}`, { method: "DELETE" }),
  bulkDelete: (ids: string[]) =>
    mutateVehicle("/vehicles/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  bulkUpdate: (ids: string[], updates: Record<string, string>) =>
    mutateVehicle("/vehicles/bulk-update", {
      method: "POST",
      body: JSON.stringify({ ids, updates }),
    }),
};
import { authenticatedRequest } from "@/lib/api-client";
import { invalidateDashboard } from "@/lib/dashboard-refresh";
