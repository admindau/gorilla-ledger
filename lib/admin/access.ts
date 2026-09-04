const DEFAULT_PLATFORM_ADMIN_EMAILS = ["admindau@proton.me"];

export function platformAdminEmails() {
  const configured = process.env.PLATFORM_ADMIN_EMAILS
    ?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return new Set(configured?.length ? configured : DEFAULT_PLATFORM_ADMIN_EMAILS);
}

export function isPlatformAdmin(email: string | null | undefined) {
  return Boolean(email && platformAdminEmails().has(email.trim().toLowerCase()));
}
