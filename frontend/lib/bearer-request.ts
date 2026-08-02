export function bearerRequestInit(
  token: string,
  init: RequestInit = {},
): RequestInit {
  const headers = new Headers(init.headers);
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  headers.delete("X-XSRF-TOKEN");
  headers.delete("X-CSRF-TOKEN");
  headers.set("Accept", "application/json");
  if (isFormData) headers.delete("Content-Type");
  else headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${token}`);

  return {
    ...init,
    headers,
    credentials: "omit",
    cache: "no-store",
  };
}
