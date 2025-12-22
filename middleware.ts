import { NextRequest, NextResponse } from "next/server";

function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  // HSTS (effective only on HTTPS)
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  return res;
}

function unauthorized(): NextResponse {
  return addSecurityHeaders(
    NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  );
}

async function sha256Bytes(input: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

/**
 * Edge-safe constant-time-ish compare:
 * - Hash both strings with SHA-256
 * - Compare hashes in constant time (no early return)
 */
async function constantTimeEquals(a: string, b: string): Promise<boolean> {
  // Hashing normalizes timing w.r.t. string length.
  const [aHash, bHash] = await Promise.all([sha256Bytes(a), sha256Bytes(b)]);

  if (aHash.length !== bHash.length) return false;

  let diff = 0;
  for (let i = 0; i < aHash.length; i++) {
    diff |= aHash[i] ^ bHash[i];
  }
  return diff === 0;
}

function extractSecretFromHeaders(req: NextRequest): string | null {
  const h =
    req.headers.get("x-cron-secret") ||
    req.headers.get("X-CRON-SECRET") ||
    req.headers.get("authorization") ||
    req.headers.get("Authorization");

  if (!h) return null;

  const v = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : h.trim();
  return v.length > 0 ? v : null;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Allow OPTIONS through (helps with preflights / tooling)
  if (req.method === "OPTIONS") {
    return addSecurityHeaders(NextResponse.next());
  }

  // 1) Protect cron endpoint (requires CRON_SECRET)
  if (pathname === "/api/cron/recurring") {
    const expected = process.env.CRON_SECRET;
    if (!expected) return unauthorized();

    const provided = extractSecretFromHeaders(req);
    if (!provided) return unauthorized();

    const ok = await constantTimeEquals(provided, expected);
    if (!ok) return unauthorized();
  }

  // 2) Protect receipt privileged endpoints (requires auth bearer token)
  if (
    pathname.startsWith("/api/receipts/") &&
    (pathname.endsWith("/sign-upload") ||
      pathname.endsWith("/sign-read") ||
      pathname.endsWith("/delete"))
  ) {
    const h =
      req.headers.get("authorization") || req.headers.get("Authorization");
    if (!h || !/^Bearer\s+.+$/i.test(h)) {
      return unauthorized();
    }
  }

  const res = NextResponse.next();
  return addSecurityHeaders(res);
}

export const config = {
  matcher: [
    "/api/cron/recurring",
    "/api/receipts/:path*",
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
