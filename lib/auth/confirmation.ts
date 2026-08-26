export const EMAIL_OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const;

export type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

export function isEmailOtpType(value: unknown): value is EmailOtpType {
  return (
    typeof value === "string" &&
    (EMAIL_OTP_TYPES as readonly string[]).includes(value)
  );
}

export function buildEmailConfirmationUrl({
  siteUrl,
  next,
  tokenHash,
  type,
}: {
  siteUrl: string;
  next: string;
  tokenHash: string;
  type: string;
}) {
  const confirmationUrl = new URL("/auth/confirm", siteUrl);
  confirmationUrl.searchParams.set("next", next);
  confirmationUrl.hash = new URLSearchParams({
    token_hash: tokenHash,
    type,
  }).toString();
  return confirmationUrl.toString();
}
