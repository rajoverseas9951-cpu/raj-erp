"use client";
import { invalidateDashboard } from "@/lib/dashboard-refresh";
import { apiUrl } from "@/lib/api-url";
import { bearerRequestInit } from "@/lib/bearer-request";


type ApiEnvelope<T> = {
  data?: T;
  message?: string;
  error?: { message?: string };
  errors?: Record<string, string[]>;
  dependency_counts?: Record<string, number>;
};
let authenticationRedirectStarted = false;

export class AuthenticationRedirectError extends Error {
  constructor() {
    super("Authentication required. Redirecting to login.");
    this.name = "AuthenticationRedirectError";
  }
}

function redirectToLogin(): never {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("raj_erp_token");
    sessionStorage.removeItem("vimawallah_user");
    if (authenticationRedirectStarted || window.location.pathname === "/login") {
      throw new AuthenticationRedirectError();
    }
    authenticationRedirectStarted = true;
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  throw new AuthenticationRedirectError();
}

export async function authenticatedRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { payload } = await authenticatedFetch<T>(path, init);
  return payload.data as T;
}

export async function authenticatedAction(
  path: string,
  init: RequestInit = {},
): Promise<{ message: string }> {
  const { payload } = await authenticatedFetch<null>(path, init);
  return { message: payload.message ?? "Request completed successfully." };
}

async function authenticatedFetch<T>(
  path: string,
  init: RequestInit,
): Promise<{ payload: ApiEnvelope<T> }> {
  if (typeof window === "undefined")
    throw new Error("Authenticated API requests must run in the browser.");
  const token = sessionStorage.getItem("raj_erp_token");
  if (!token) redirectToLogin();

  let response: Response;
  try {
    response = await fetch(apiUrl(path), bearerRequestInit(token, init));
  } catch {
    throw new Error("Unable to reach the server. Check your network connection and try again.");
  }

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (
    response.status === 401 ||
    /unauthenticated/i.test(payload.message ?? payload.error?.message ?? "")
  )
    redirectToLogin();
  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error("The server could not complete the request. Please try again.");
    }
    const validationError = payload.errors
      ? Object.values(payload.errors)[0]?.[0]
      : undefined;
    const dependencySummary = payload.dependency_counts
      ? ` (${Object.entries(payload.dependency_counts).map(([name, count]) => `${name.replaceAll("_", " ")}: ${count}`).join(", ")})`
      : "";
    throw new Error(
      (validationError ??
        payload.message ??
        payload.error?.message ??
        `API request failed: ${response.status}`) + dependencySummary,
    );
  }
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") invalidateDashboard();
  return { payload };
}
