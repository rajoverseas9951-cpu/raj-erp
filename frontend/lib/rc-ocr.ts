export type VehicleFormValues = Record<string, string>;
export type OcrMasterOption = { id: string; name: string; parent_id?: string | null };
export type OcrMasterKind =
  | "manufacturers"
  | "models"
  | "variants"
  | "colours"
  | "vehicle_types"
  | "vehicle_classes"
  | "body_types"
  | "fuel_types"
  | "rto_offices";

export const OCR_PREFILL_FIELDS = [
  "vehicle_number",
  "registration_date",
  "registration_authority",
  "rto_office_id",
  "state",
  "district",
  "vehicle_type",
  "vehicle_type_id",
  "vehicle_class",
  "vehicle_class_id",
  "vehicle_category",
  "vehicle_category_id",
  "manufacturer",
  "manufacturer_id",
  "model",
  "model_id",
  "manufacturing_year",
  "colour",
  "colour_id",
  "fuel_type",
  "fuel_type_id",
  "seating_capacity",
  "cubic_capacity",
  "gross_weight",
  "unladen_weight",
  "number_of_cylinders",
  "chassis_number",
  "engine_number",
  "financier",
] as const;

const OCR_PREFILL_SET = new Set<string>(OCR_PREFILL_FIELDS);

function normalizedMasterText(value: string, type: OcrMasterKind): string {
  let normalized = value.toUpperCase().replaceAll("GRAY", "GREY");
  normalized = normalized.replaceAll("+", type === "models" ? " PLUS " : " ");
  if (type === "manufacturers") {
    normalized = normalized.replace(
      /\b(?:PRIVATE|PVT)\s+LIMITED\b|\bPVT\.?\s+LTD\.?\b|\bLIMITED\b|\bLTD\.?\b|\bINDIA\b/g,
      " ",
    );
  }
  return normalized.replace(/[^A-Z0-9]+/g, "");
}

export function findMatchingMasterId(
  value: string,
  options: readonly OcrMasterOption[],
  type: OcrMasterKind,
): string {
  if (!value.trim()) return "";
  const target = normalizedMasterText(value, type);
  return (
    options.find((option) => normalizedMasterText(option.name, type) === target)
      ?.id ?? ""
  );
}

export function getOcrMasterControlState(
  value: string,
  unresolvedText: string,
  options: readonly OcrMasterOption[],
): {
  fallbackValue: string;
  fallbackLabel: string;
  visibleText: string;
} {
  const selected = options.find((option) => option.id === value);
  const showOcrValue = Boolean(unresolvedText && (!value || !selected));
  return {
    fallbackValue: showOcrValue ? value : "",
    fallbackLabel: showOcrValue ? `${unresolvedText} (OCR)` : "",
    visibleText: selected?.name ?? (showOcrValue ? unresolvedText : ""),
  };
}

export type OcrMasterLists = Partial<
  Record<OcrMasterKind, readonly OcrMasterOption[]>
>;

export function mergeOcrMasterOptions(
  current: OcrMasterLists,
  incoming: Partial<Record<OcrMasterKind, OcrMasterOption>> = {},
): OcrMasterLists {
  const next: OcrMasterLists = { ...current };
  for (const [type, master] of Object.entries(incoming)) {
    if (!master) continue;
    const key = type as OcrMasterKind;
    next[key] = [
      ...(next[key] ?? []).filter((option) => option.id !== master.id),
      master,
    ];
  }
  return next;
}

const MASTER_BINDINGS: ReadonlyArray<{
  type: OcrMasterKind;
  nameField: string;
  idField: string;
  parentIdField?: string;
}> = [
  { type: "rto_offices", nameField: "registration_authority", idField: "rto_office_id" },
  { type: "vehicle_types", nameField: "vehicle_type", idField: "vehicle_type_id" },
  { type: "vehicle_classes", nameField: "vehicle_class", idField: "vehicle_class_id" },
  { type: "body_types", nameField: "vehicle_category", idField: "vehicle_category_id" },
  { type: "manufacturers", nameField: "manufacturer", idField: "manufacturer_id" },
  { type: "models", nameField: "model", idField: "model_id", parentIdField: "manufacturer_id" },
  { type: "colours", nameField: "colour", idField: "colour_id" },
  { type: "fuel_types", nameField: "fuel_type", idField: "fuel_type_id" },
];

export function resolveOcrMasterIds(
  values: VehicleFormValues,
  lists: OcrMasterLists,
  editedFields: ReadonlySet<string> = new Set(),
): VehicleFormValues {
  const next = { ...values };
  for (const binding of MASTER_BINDINGS) {
    if (
      next[binding.idField] ||
      !next[binding.nameField]?.trim() ||
      editedFields.has(binding.nameField) ||
      editedFields.has(binding.idField)
    ) {
      continue;
    }

    const parentId = binding.parentIdField
      ? next[binding.parentIdField]
      : "";
    if (binding.parentIdField && !parentId) continue;
    const options = (lists[binding.type] ?? []).filter(
      (option) => !parentId || !option.parent_id || option.parent_id === parentId,
    );
    const id = findMatchingMasterId(
      next[binding.nameField],
      options,
      binding.type,
    );
    if (id) next[binding.idField] = id;
  }

  return next;
}

function normalizeOcrDate(value: string): string {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const indian = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (indian) {
    return `${indian[3]}-${indian[2].padStart(2, "0")}-${indian[1].padStart(2, "0")}`;
  }
  return trimmed;
}

export function applyOcrPrefill(
  current: VehicleFormValues,
  extracted: Record<string, string>,
  editedFields: ReadonlySet<string>,
): VehicleFormValues {
  const next = { ...current };
  for (const field of OCR_PREFILL_FIELDS) {
    if (!editedFields.has(field)) next[field] = "";
  }
  for (const [field, value] of Object.entries(extracted)) {
    if (!OCR_PREFILL_SET.has(field) || editedFields.has(field) || value === "") {
      continue;
    }
    next[field] = field === "registration_date"
      ? normalizeOcrDate(String(value))
      : String(value);
  }
  next.customer_id = current.customer_id;
  return next;
}

const COMMERCIAL_VEHICLE_PATTERN =
  /\b(?:COMMERCIAL|GOODS?|TRANSPORT|HGV|LGV|MGV|HMV|TRUCK|LORRY|TRAILER|PICK\s*UP|PICKUP|BUS|TAXI|CAB|MAXI|PSV|PASSENGER|STAGE\s+CARRIAGE|CONTRACT\s+CARRIAGE)\b/i;

export function isCommercialVehicle(values: {
  vehicle_type?: string;
  vehicle_class?: string;
  vehicle_category?: string;
}): boolean {
  return COMMERCIAL_VEHICLE_PATTERN.test(
    [values.vehicle_type, values.vehicle_class, values.vehicle_category]
      .filter(Boolean)
      .join(" ")
      .replaceAll("_", " "),
  );
}

const VEHICLE_FORM_FIELDS = [
  "customer_id",
  "vehicle_number",
  "registration_date",
  "registration_authority",
  "rto_office_id",
  "state",
  "district",
  "vehicle_type",
  "vehicle_type_id",
  "vehicle_class",
  "vehicle_class_id",
  "vehicle_category",
  "vehicle_category_id",
  "manufacturer",
  "manufacturer_id",
  "model",
  "model_id",
  "manufacturing_year",
  "colour",
  "colour_id",
  "fuel_type",
  "fuel_type_id",
  "seating_capacity",
  "cubic_capacity",
  "unladen_weight",
  "number_of_cylinders",
  "chassis_number",
  "engine_number",
  "financier",
  "insurance_status",
  "fitness_status",
  "permit_status",
  "tax_status",
  "puc_status",
  "insurance_expiry",
  "puc_expiry",
  "fitness_expiry",
  "permit_expiry",
  "national_permit_expiry",
  "tax_expiry",
  "counter_tax_expiry",
] as const;

const NUMERIC_VEHICLE_FORM_FIELDS = new Set([
  "manufacturing_year",
  "seating_capacity",
  "cubic_capacity",
  "unladen_weight",
  "number_of_cylinders",
]);

export function buildVehicleFormPayload(
  values: VehicleFormValues,
): Record<string, string | number | boolean | null> {
  const payload: Record<string, string | number | boolean | null> = {};
  for (const field of VEHICLE_FORM_FIELDS) {
    const value = values[field] ?? "";
    payload[field] = NUMERIC_VEHICLE_FORM_FIELDS.has(field)
      ? value === "" ? null : Number(value)
      : value;
  }
  if (isCommercialVehicle(values)) {
    payload.gross_weight = values.gross_weight
      ? Number(values.gross_weight)
      : null;
  }
  payload.hypothecation = Boolean(values.financier);
  return payload;
}
