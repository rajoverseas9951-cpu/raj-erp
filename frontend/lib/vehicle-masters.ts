"use client";
import { authenticatedRequest } from "@/lib/api-client";

export type VehicleMasterType =
  | "manufacturers"
  | "models"
  | "variants"
  | "colours"
  | "vehicle_types"
  | "vehicle_classes"
  | "body_types"
  | "fuel_types"
  | "rto_offices";
export type VehicleMaster = {
  id: string;
  type: VehicleMasterType;
  name: string;
  code?: string;
  parent_id?: string;
  parent_name?: string;
  status: "active" | "inactive";
  notes?: string;
  source?: "OCR" | string;
};
export type VehicleMasterPageResult = {
  data: VehicleMaster[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export const vehicleMasterApi = {
  list: (type: VehicleMasterType) =>
    authenticatedRequest<VehicleMaster[]>(`/vehicle-masters/${type}`),
  models: (manufacturerId: string) =>
    authenticatedRequest<VehicleMaster[]>(
      `/vehicle-masters/models?manufacturer_id=${encodeURIComponent(manufacturerId)}&status=active`,
    ),
  variants: (modelId: string) =>
    authenticatedRequest<VehicleMaster[]>(
      `/vehicle-masters/variants?model_id=${encodeURIComponent(modelId)}&status=active`,
    ),
  page: (type: VehicleMasterType, page: number, search = "") =>
    authenticatedRequest<VehicleMasterPageResult>(
      `/vehicle-masters/${type}?paginate=1&per_page=20&page=${page}&search=${encodeURIComponent(search)}`,
    ),
  create: (type: VehicleMasterType, body: Record<string, unknown>) =>
    authenticatedRequest<VehicleMaster>(`/vehicle-masters/${type}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (
    type: VehicleMasterType,
    id: string,
    body: Record<string, unknown>,
  ) =>
    authenticatedRequest<VehicleMaster>(`/vehicle-masters/${type}/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (type: VehicleMasterType, id: string) =>
    authenticatedRequest<null>(`/vehicle-masters/${type}/${id}`, {
      method: "DELETE",
    }),
};
