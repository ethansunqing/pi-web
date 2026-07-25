function canonicalOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

/**
 * Public origin as the browser sees it.
 *
 * Next.js proxy/middleware often normalizes `request.url` to `http://localhost:PORT`
 * even when the page was opened via a LAN IP / hostname (e.g. http://192.168.x.x:3000).
 * Comparing Origin only to `request.url` then falsely returns 403 for same-site POSTs.
 * Prefer Host / X-Forwarded-* so LAN and reverse-proxy access work.
 */
export function getPublicRequestOrigin(request: Request): string | null {
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const host = forwardedHost || firstHeaderValue(request.headers.get("host"));
  if (host) {
    const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
    const urlOrigin = canonicalOrigin(request.url);
    const proto =
      forwardedProto ||
      (urlOrigin?.startsWith("https:") ? "https" : "http");
    return canonicalOrigin(`${proto}://${host}`);
  }
  return canonicalOrigin(request.url);
}

/** Reject browser cross-site API requests while preserving non-browser clients. */
export function isApiRequestOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  if (!origin) return true;

  const requestOrigin = getPublicRequestOrigin(request);
  return requestOrigin !== null && canonicalOrigin(origin) === requestOrigin;
}

export function shouldCheckApiRequestOrigin(request: Request): boolean {
  return request.headers.has("origin") || request.headers.has("sec-fetch-site");
}
