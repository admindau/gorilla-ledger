import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Routes that require an authenticated session.
 * Keep this list explicit to avoid accidentally gating public pages.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/wallets",
  "/transactions",
  "/budgets",
  "/categories",
  "/recurring",
  "/settings",
];

/**
 * Public routes that should never be redirected by auth middleware.
 */
const PUBLIC_PREFIXES = ["/auth", "/api", "/_next", "/favicon.ico", "/robots.txt", "/sitemap.xml"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  return res;
}

/**
 * Prevent caching of authenticated pages (helps with back-button + intermediaries).
 */
function addNoStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
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
  const [aHash, bHash] = await Promise.all([sha256Bytes(a), sha256Bytes(b)]);
  if (aHash.length !== bHash.length) return false;

  let diff = 0;
  for (let i = 0; i < aHash.length; i++) diff |= aHash[i] ^ bHash[i];
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

  // Allow OPTIONS through (preflights / tooling)
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
    const h = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!h || !/^Bearer\s+.+$/i.test(h)) return unauthorized();
  }

  // 3) Auth-gate protected PAGE routes at the edge
  // - We do NOT gate /api/* here, because you likely have mixed public/private endpoints.
  // - We DO gate the app pages that must be inaccessible without a session.
  const shouldAuthGate =
    !isPublicPath(pathname) &&
    isProtectedPath(pathname);

  const res = NextResponse.next();
  addSecurityHeaders(res);

  if (!shouldAuthGate) {
    return res;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Fail closed on protected routes if env is missing
    const fail = NextResponse.redirect(new URL("/auth/login?error=missing_env", req.url));
    addSecurityHeaders(fail);
    addNoStore(fail);
    return fail;
  }

  // Create an SSR client inside middleware so auth cookies are read/written correctly.
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();

  if (!data?.user) {
    const login = new URL("/auth/login", req.url);
    login.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(login);

    addSecurityHeaders(redirect);
    addNoStore(redirect);
    return redirect;
  }

  // Authenticated: ensure protected pages are not cached.
  addNoStore(res);
  return res;
}

export const config = {
  matcher: [
    "/api/cron/recurring",
    "/api/receipts/:path*",
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
