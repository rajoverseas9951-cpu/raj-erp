import type { DashboardPeriod } from "@/lib/dashboard-api";

export const DASHBOARD_PERIODS: ReadonlyArray<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "all_time", label: "All Time" },
  { value: "custom", label: "Custom Date Range" },
];

export function dashboardPeriodLabel(period: DashboardPeriod): string {
  return DASHBOARD_PERIODS.find((option) => option.value === period)?.label ?? "Today";
}

export function dashboardQuery(filters: { period: DashboardPeriod; dateFrom?: string; dateTo?: string }): string {
  const query = new URLSearchParams({ period: filters.period });
  if (filters.period === "custom" && filters.dateFrom && filters.dateTo) {
    query.set("date_from", filters.dateFrom);
    query.set("date_to", filters.dateTo);
  }
  return query.toString();
}
