import { apiUrl } from "@/lib/api-url";

export type ApiError = {
  message?: string;
  errors?: Record<string, string[]>;
};

export async function authRequest<T>(
  path: string,
  body: Record<string, string>
): Promise<T> {
  const response = await fetch(apiUrl(`/auth/${path}`), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as {
    data?: T;
    message?: string;
    error?: { message?: string };
    errors?: Record<string, string[]>;
  };

  if (!response.ok) {
    const firstError = payload.errors
      ? Object.values(payload.errors)[0]?.[0]
      : undefined;

    throw new Error(
      firstError ??
        payload.message ??
        payload.error?.message ??
        "Unable to complete the request."
    );
  }

  return payload.data as T;
}
