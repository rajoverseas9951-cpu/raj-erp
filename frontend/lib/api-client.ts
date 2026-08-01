"use client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type ApiEnvelope<T> = {
  data?: T;
  message?: string;
  error?: { message?: string };
  errors?: Record<string, string[]>;
};

export class AuthenticationRedirectError extends Error {
  constructor() {
    super("Authentication required. Redirecting to login.");
    this.name = "AuthenticationRedirectError";
  }
}

function redirectToLogin(): never {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("raj_erp_token");
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  throw new AuthenticationRedirectError();
}

export async function authenticatedRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (typeof window === "undefined")
    throw new Error("Authenticated API requests must run in the browser.");
  const token = sessionStorage.getItem("raj_erp_token");
  if (!token) redirectToLogin();

  const isFormData = init.body instanceof FormData;
  const response = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (
    response.status === 401 ||
    /unauthenticated/i.test(payload.message ?? payload.error?.message ?? "")
  )
    redirectToLogin();
  if (!response.ok) {
    const validationError = payload.errors
      ? Object.values(payload.errors)[0]?.[0]
      : undefined;
    throw new Error(
      validationError ??
        payload.message ??
        payload.error?.message ??
        `API request failed: ${response.status}`,
    );
  }
  return payload.data as T;
}
