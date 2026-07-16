// proxy.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { applyPrivateNoStore } from "@/lib/http/privateCache";
import {
  DEFAULT_APP_DESTINATION,
  shouldRedirectAuthenticatedHome,
} from "@/lib/auth/navigation";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/wallets",
  "/transactions",
  "/categories",
  "/budgets",
  "/recurring",
  "/exports",
  "/settings",
  "/mfa",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function redirectPreservingCookies(url: URL, sourceResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
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

  if (shouldRedirectAuthenticatedHome(req.nextUrl.pathname, Boolean(user))) {
    const dashboardUrl = req.nextUrl.clone();
    dashboardUrl.pathname = DEFAULT_APP_DESTINATION;
    dashboardUrl.search = "";
    const redirectResponse = redirectPreservingCookies(dashboardUrl, res);
    applyPrivateNoStore(redirectResponse.headers);
    return redirectResponse;
  }

  if (isProtectedPath(req.nextUrl.pathname)) {
    applyPrivateNoStore(res.headers);

    if (!user) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
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
