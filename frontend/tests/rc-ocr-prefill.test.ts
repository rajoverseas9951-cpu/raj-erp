import assert from "node:assert/strict";
import test from "node:test";
// Node's built-in TypeScript runner requires the explicit extension.
// @ts-expect-error TypeScript's bundler mode omits runtime `.ts` extensions in application code.
import { applyOcrPrefill, findMatchingMasterId, resolveOcrMasterIds } from "../lib/rc-ocr.ts";

test("OCR prefill preserves customer and user-edited fields", () => {
  const current = {
    customer_id: "customer-explicitly-selected",
    vehicle_number: "GJ01USER1",
    manufacturer: "USER CHANGED MAKE",
    manufacturer_id: "user-make-id",
    model: "",
    model_id: "",
    state: "Gujarat",
  };
  const extracted = {
    customer_id: "must-never-be-used",
    owner_name: "RABARI NARSEGBHAI",
    vehicle_number: "GJ08DH9235",
    manufacturer: "HERO MOTOCORP",
    manufacturer_id: "ocr-make-id",
    model: "SPLENDOR PLUS",
    model_id: "ocr-model-id",
  };

  const merged = applyOcrPrefill(
    current,
    extracted,
    new Set(["vehicle_number", "manufacturer", "manufacturer_id"]),
  );

  assert.equal(merged.customer_id, "customer-explicitly-selected");
  assert.equal(merged.vehicle_number, "GJ01USER1");
  assert.equal(merged.manufacturer, "USER CHANGED MAKE");
  assert.equal(merged.manufacturer_id, "user-make-id");
  assert.equal(merged.model, "SPLENDOR PLUS");
  assert.equal(merged.model_id, "ocr-model-id");
  assert.equal(merged.owner_name, undefined);
});

test("a new OCR result clears stale unedited optional fields", () => {
  const merged = applyOcrPrefill(
    { customer_id: "", colour: "BLACK", state: "Gujarat" },
    { colour: "", financier: "" },
    new Set(),
  );

  assert.equal(merged.colour, "");
  assert.equal(merged.state, "");
  assert.equal(merged.financier, "");
});

test("a tractor scan cannot inherit motorcycle OCR values", () => {
  const motorcycle = applyOcrPrefill(
    { customer_id: "customer-id" },
    {
      financier: "ROYAL FINANCE THARAD",
      cubic_capacity: "97.20",
      unladen_weight: "109",
      emission_norms: "BHARAT STAGE VI",
      variant: "DRS",
      variant_id: "variant-id",
    },
    new Set(),
  );
  const tractor = applyOcrPrefill(
    motorcycle,
    {
      vehicle_number: "GJ08BB6056",
      manufacturer: "ESCORTS LTD",
      cubic_capacity: "45",
      financier: "L AND T FINANCE LTD",
      number_of_cylinders: "3",
      manufacturing_month: "01",
      manufacturing_year: "2016",
    },
    new Set(),
  );

  assert.equal(tractor.customer_id, "customer-id");
  assert.equal(tractor.financier, "L AND T FINANCE LTD");
  assert.equal(tractor.cubic_capacity, "45");
  assert.equal(tractor.unladen_weight, "");
  assert.equal(tractor.emission_norms, "");
  assert.equal(tractor.variant, "");
  assert.equal(tractor.variant_id, "");
  assert.equal(tractor.horse_power, "");
  assert.equal(tractor.wheel_base, "");
});

test("manual fields remain protected while other OCR fields reset", () => {
  const merged = applyOcrPrefill(
    {
      customer_id: "customer-id",
      financier: "USER VERIFIED FINANCIER",
      unladen_weight: "109",
    },
    { cubic_capacity: "45" },
    new Set(["financier"]),
  );

  assert.equal(merged.financier, "USER VERIFIED FINANCIER");
  assert.equal(merged.unladen_weight, "");
  assert.equal(merged.cubic_capacity, "45");
});

test("valid OCR master text remains visible until its master ID resolves", () => {
  const unresolved = applyOcrPrefill(
    { customer_id: "customer-id" },
    { manufacturer: "ESCORTS LTD", model: "FARMTRAC 45" },
    new Set(),
  );

  assert.equal(unresolved.manufacturer, "ESCORTS LTD");
  assert.equal(unresolved.manufacturer_id, "");
  assert.equal(unresolved.model, "FARMTRAC 45");
  const manufacturerId = findMatchingMasterId(
    unresolved.manufacturer,
    [{ id: "escorts-id", name: "ESCORTS" }],
    "manufacturers",
  );
  const resolved = applyOcrPrefill(
    unresolved,
    {
      manufacturer: unresolved.manufacturer,
      manufacturer_id: manufacturerId,
      model: unresolved.model,
      model_id: "farmtrac-45-id",
    },
    new Set(),
  );

  assert.equal(resolved.manufacturer, "ESCORTS LTD");
  assert.equal(resolved.manufacturer_id, "escorts-id");
  assert.equal(resolved.model, "FARMTRAC 45");
  assert.equal(resolved.model_id, "farmtrac-45-id");
});

test("the complete tractor prefill survives delayed dependent master loading", async () => {
  const priorMotorcycle = applyOcrPrefill(
    { customer_id: "customer-id" },
    {
      financier: "ROYAL FINANCE THARAD",
      manufacturing_month: "02",
      manufacturing_year: "2024",
      cubic_capacity: "97.20",
      horse_power: "7.91",
      wheel_base: "1236",
      unladen_weight: "109",
      emission_norms: "BHARAT STAGE VI",
      fuel_type: "PETROL",
    },
    new Set(),
  );
  const expected = {
    vehicle_number: "GJ08BB6056",
    registration_date: "2016-12-06",
    registration_valid_upto: "2031-12-05",
    registration_authority: "PALANPUR",
    state: "Gujarat",
    district: "PALANPUR",
    vehicle_type: "tractor",
    vehicle_class: "TRACTOR (AGRI)",
    vehicle_category: "TRACTOR (OPEN)",
    manufacturer: "ESCORTS LTD",
    model: "FARMTRAC 45",
    fuel_type: "DIESEL",
    colour: "BLUE",
    manufacturing_month: "01",
    manufacturing_year: "2016",
    seating_capacity: "1",
    cubic_capacity: "45",
    number_of_cylinders: "3",
    chassis_number: "T052358130",
    engine_number: "E2363463",
    financier: "L AND T FINANCE LTD",
  };
  const beforeMasters = applyOcrPrefill(
    priorMotorcycle,
    { ...expected, registration_date: "06/12/2016" },
    new Set(),
  );

  for (const [field, value] of Object.entries(expected)) {
    assert.equal(beforeMasters[field], value, `${field} should prefill as text`);
  }
  assert.equal(beforeMasters.manufacturer_id, "");
  assert.equal(beforeMasters.model_id, "");
  assert.equal(beforeMasters.variant, "");
  assert.equal(beforeMasters.wheel_base, "");
  assert.equal(beforeMasters.horse_power, "");
  assert.equal(beforeMasters.unladen_weight, "");
  assert.equal(beforeMasters.emission_norms, "");
  assert.notEqual(beforeMasters.fuel_type, "USED");
  assert.notEqual(beforeMasters.financier, "ROYAL FINANCE THARAD");

  const delayedLists = await Promise.resolve({
    rto_offices: [{ id: "pal-id", name: "PALANPUR" }],
    vehicle_types: [{ id: "tractor-id", name: "TRACTOR" }],
    vehicle_classes: [{ id: "class-id", name: "TRACTOR (AGRI)" }],
    body_types: [{ id: "body-id", name: "TRACTOR (OPEN)" }],
    manufacturers: [{ id: "escorts-id", name: "ESCORTS" }],
    models: [
      {
        id: "farmtrac-id",
        name: "FARMTRAC 45",
        parent_id: "escorts-id",
      },
    ],
    variants: [],
    colours: [{ id: "blue-id", name: "BLUE" }],
    fuel_types: [{ id: "diesel-id", name: "DIESEL" }],
  });
  const afterMasters = resolveOcrMasterIds(beforeMasters, delayedLists);

  assert.equal(afterMasters.manufacturer, "ESCORTS LTD");
  assert.equal(afterMasters.manufacturer_id, "escorts-id");
  assert.equal(afterMasters.model, "FARMTRAC 45");
  assert.equal(afterMasters.model_id, "farmtrac-id");
  assert.equal(afterMasters.vehicle_type_id, "tractor-id");
  assert.equal(afterMasters.vehicle_class_id, "class-id");
  assert.equal(afterMasters.vehicle_category_id, "body-id");
  assert.equal(afterMasters.rto_office_id, "pal-id");
  assert.equal(afterMasters.colour_id, "blue-id");
  assert.equal(afterMasters.fuel_type_id, "diesel-id");
});
