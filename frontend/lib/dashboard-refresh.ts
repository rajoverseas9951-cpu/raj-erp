"use client";

export const DASHBOARD_REFRESH_EVENT = "vimawallah:dashboard-refresh";
const STORAGE_KEY = "vimawallah_dashboard_invalidated_at";

export function invalidateDashboard(): void {
  if (typeof window === "undefined") return;
  const timestamp = String(Date.now());
  localStorage.setItem(STORAGE_KEY, timestamp);
  window.dispatchEvent(new CustomEvent(DASHBOARD_REFRESH_EVENT, { detail: timestamp }));
}

export function dashboardInvalidationTimestamp(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
}
