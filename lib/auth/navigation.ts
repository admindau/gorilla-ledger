export const DEFAULT_APP_DESTINATION = "/dashboard";

export function shouldRedirectAuthenticatedHome(
  pathname: string,
  authenticated: boolean
) {
  return authenticated && pathname === "/";
}
