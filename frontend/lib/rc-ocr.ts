export type VehicleFormValues = Record<string, string>;

export const OCR_PREFILL_FIELDS = [
  "vehicle_number",
  "registration_date",
  "registration_valid_upto",
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
  "variant",
  "variant_id",
  "manufacturing_year",
  "manufacturing_month",
  "colour",
  "colour_id",
  "fuel_type",
  "fuel_type_id",
  "seating_capacity",
  "cubic_capacity",
  "gross_weight",
  "unladen_weight",
  "number_of_cylinders",
  "emission_norms",
  "horse_power",
  "wheel_base",
  "chassis_number",
  "engine_number",
  "financier",
] as const;

const OCR_PREFILL_SET = new Set<string>(OCR_PREFILL_FIELDS);

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
    next[field] = String(value);
  }
  next.customer_id = current.customer_id;
  return next;
}
