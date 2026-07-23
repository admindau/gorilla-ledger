export const DEFAULT_APP_DESTINATION = "/dashboard";

const APP_ORIGIN = "https://app.gorilla-ledger.local";
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
] as const;

export function isProtectedAppPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function shouldRedirectAuthenticatedHome(
  pathname: string,
  authenticated: boolean
) {
  return authenticated && pathname === "/";
}

export function shouldRedirectAuthenticatedLogin(
  pathname: string,
  authenticated: boolean
) {
  return authenticated && pathname === "/auth/login";
}

export function sanitizeAppDestination(
  value: string | null | undefined,
  fallback = DEFAULT_APP_DESTINATION
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const destination = new URL(value, APP_ORIGIN);
    if (destination.origin !== APP_ORIGIN) return fallback;
    if (destination.pathname === "/" || destination.pathname.startsWith("/auth/")) {
      return fallback;
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}

export function sanitizeConfirmationDestination(
  value: string | null | undefined,
  fallback = DEFAULT_APP_DESTINATION
) {
  const destination = sanitizeAppDestination(value, fallback);

  try {
    const parsed = new URL(destination, APP_ORIGIN);
    return isProtectedAppPath(parsed.pathname) ? destination : fallback;
  } catch {
    return fallback;
  }
}

export function requiresMfaStepUp(
  currentLevel: string | null | undefined,
  nextLevel: string | null | undefined
) {
  return nextLevel === "aal2" && currentLevel !== "aal2";
}
