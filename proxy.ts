// proxy.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { applyPrivateNoStore } from "@/lib/http/privateCache";
import {
  DEFAULT_APP_DESTINATION,
  isProtectedAppPath,
  requiresMfaStepUp,
  sanitizeAppDestination,
  shouldRedirectAuthenticatedHome,
  shouldRedirectAuthenticatedLogin,
} from "@/lib/auth/navigation";

function redirectPreservingCookies(url: URL, sourceResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

function serviceUnavailable() {
  const response = new NextResponse(
    "Gorilla Ledger could not verify account security. Please try again shortly.",
    {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }
  );
  applyPrivateNoStore(response.headers);
  return response;
}

function authUnavailableRedirect(
  req: NextRequest,
  sourceResponse: NextResponse,
  next: string
) {
  const unavailableUrl = req.nextUrl.clone();
  unavailableUrl.pathname = "/auth/unavailable";
  unavailableUrl.search = "";
  unavailableUrl.searchParams.set("next", next);
  const response = redirectPreservingCookies(unavailableUrl, sourceResponse);
  applyPrivateNoStore(response.headers);
  return response;
}

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;
  const protectedPath = isProtectedAppPath(pathname);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (protectedPath) return serviceUnavailable();
    return res;
  }

  const supabase = createServerClient(url, anonKey, {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authenticatedHome = shouldRedirectAuthenticatedHome(pathname, Boolean(user));
  const authenticatedLogin = shouldRedirectAuthenticatedLogin(pathname, Boolean(user));
  const requestedDestination = authenticatedLogin
    ? sanitizeAppDestination(req.nextUrl.searchParams.get("next"))
    : authenticatedHome
      ? DEFAULT_APP_DESTINATION
      : sanitizeAppDestination(`${pathname}${req.nextUrl.search}`);

  if (user && (protectedPath || authenticatedHome || authenticatedLogin)) {
    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (assuranceError || !assurance) {
      return authUnavailableRedirect(req, res, requestedDestination);
    }

    if (requiresMfaStepUp(assurance.currentLevel, assurance.nextLevel)) {
      const mfaUrl = req.nextUrl.clone();
      mfaUrl.pathname = "/auth/mfa";
      mfaUrl.search = "";
      mfaUrl.searchParams.set("mode", "stepup");
      mfaUrl.searchParams.set("next", requestedDestination);
      const redirectResponse = redirectPreservingCookies(mfaUrl, res);
      applyPrivateNoStore(redirectResponse.headers);
      return redirectResponse;
    }
  }

  if (authenticatedHome || authenticatedLogin) {
    const dashboardUrl = req.nextUrl.clone();
    const destination = new URL(requestedDestination, req.nextUrl.origin);
    dashboardUrl.pathname = destination.pathname;
    dashboardUrl.search = destination.search;
    const redirectResponse = redirectPreservingCookies(dashboardUrl, res);
    applyPrivateNoStore(redirectResponse.headers);
    return redirectResponse;
  }

  if (protectedPath) {
    applyPrivateNoStore(res.headers);

    if (!user) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("next", requestedDestination);
      const redirectResponse = redirectPreservingCookies(loginUrl, res);
      applyPrivateNoStore(redirectResponse.headers);
      return redirectResponse;
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
