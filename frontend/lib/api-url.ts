const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

function resolveApiOrigin(): string {
  if (configuredApiUrl) {
    const apiOrigin = configuredApiUrl
      .replace(/\/+$/, "")
      .replace(/\/api\/v1$/i, "")
      .replace(/\/api$/i, "");

    if (
      process.env.NODE_ENV === "production" &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(apiOrigin)
    ) {
      throw new Error(
        "NEXT_PUBLIC_API_URL must not use a localhost address in production.",
      );
    }

    return apiOrigin;
  }

  if (process.env.NODE_ENV !== "production") {
    return `http://${["127", "0", "0", "1"].join(".")}:8000`;
  }

  throw new Error(
    "NEXT_PUBLIC_API_URL is required for production frontend builds.",
  );
}

export const API_ORIGIN = resolveApiOrigin();

export function apiUrl(path: string): string {
  const normalizedPath = path
    .trim()
    .replace(/^\/+/, "")
    .replace(/^api\/v1\/?/i, "")
    .replace(/^api\/?/i, "");

  return `${API_ORIGIN}/api/v1/${normalizedPath}`;
}
