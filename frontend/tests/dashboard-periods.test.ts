import assert from "node:assert/strict";
import test from "node:test";
// Node's built-in TypeScript runner requires the explicit extension.
// @ts-expect-error TypeScript's bundler mode omits runtime `.ts` extensions in application code.
import { DASHBOARD_PERIODS, dashboardPeriodLabel, dashboardQuery } from "../lib/dashboard-periods.ts";

test("dashboard exposes every supported period in the required order", () => {
  assert.deepEqual(DASHBOARD_PERIODS.map(({ value }) => value), [
    "today", "yesterday", "this_week", "this_month", "last_month", "this_year", "all_time", "custom",
  ]);
  for (const option of DASHBOARD_PERIODS) assert.equal(dashboardPeriodLabel(option.value), option.label);
});

test("each standard period sends only its period parameter", () => {
  for (const period of DASHBOARD_PERIODS.map(({ value }) => value).filter((value) => value !== "custom")) {
    assert.equal(dashboardQuery({ period }), `period=${period}`);
  }
});

test("custom period sends inclusive from and to parameters", () => {
  assert.equal(
    dashboardQuery({ period: "custom", dateFrom: "2026-08-01", dateTo: "2026-08-02" }),
    "period=custom&date_from=2026-08-01&date_to=2026-08-02",
  );
});
