// proxy.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/wallets",
  "/transactions",
  "/categories",
  "/budgets",
  "/recurring",
  "/settings",
  "/mfa",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
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

  if (isProtectedPath(req.nextUrl.pathname)) {
    res.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");

    if (!user) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
