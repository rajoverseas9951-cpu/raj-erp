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

test("blank optional OCR fields do not erase existing form values", () => {
  const merged = applyOcrPrefill(
    { customer_id: "", colour: "BLACK", state: "Gujarat" },
    { colour: "", financier: "" },
    new Set(),
  );

  assert.equal(merged.colour, "BLACK");
  assert.equal(merged.financier, undefined);
});
