"use client";
import { authenticatedRequest } from "@/lib/api-client";

export type VehicleMasterType =
  | "manufacturers"
  | "models"
  | "colours"
  | "vehicle_classes"
  | "body_types"
  | "fuel_types";
export type VehicleMaster = {
  id: string;
  type: VehicleMasterType;
  name: string;
  code?: string;
  parent_id?: string;
  parent_name?: string;
  status: "active" | "inactive";
  notes?: string;
};

export const vehicleMasterApi = {
  list: (type: VehicleMasterType) =>
    authenticatedRequest<VehicleMaster[]>(`/vehicle-masters/${type}`),
  models: (manufacturerId: string) =>
    authenticatedRequest<VehicleMaster[]>(
      `/vehicle-masters/models?manufacturer_id=${encodeURIComponent(manufacturerId)}&status=active`,
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
