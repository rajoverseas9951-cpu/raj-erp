const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

function resolveApiOrigin(): string {
  if (configuredApiUrl) {
    const apiOrigin = configuredApiUrl
      .replace(/\/+$/, "")
      .replace(/\/api\/v1$/i, "")
      .replace(/\/api$/i, "");
    let parsed: URL;
    try {
      parsed = new URL(apiOrigin);
    } catch {
      throw new Error("NEXT_PUBLIC_API_URL must be a valid absolute URL.");
    }

    if (
      process.env.NODE_ENV === "production" &&
      (parsed.protocol !== "https:" ||
        !parsed.hostname.includes(".") ||
        /^\d{1,3}(?:\.\d{1,3}){3}$/.test(parsed.hostname))
    ) {
      throw new Error(
        "NEXT_PUBLIC_API_URL must be a public HTTPS origin in production.",
      );
    }

    return apiOrigin;
  }

  throw new Error(
    "NEXT_PUBLIC_API_URL is required for frontend builds.",
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
