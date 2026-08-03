import assert from "node:assert/strict";
import test from "node:test";
// Node's built-in TypeScript runner requires the explicit extension.
// @ts-expect-error TypeScript's bundler mode omits runtime `.ts` extensions in application code.
import { applyOcrPrefill } from "../lib/rc-ocr.ts";

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
