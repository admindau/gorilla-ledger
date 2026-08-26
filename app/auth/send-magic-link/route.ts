import { NextRequest, NextResponse } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeConfirmationDestination } from "@/lib/auth/navigation";
import { sendEmail } from "@/lib/email";
import { COMPANY_NAME, PRODUCT_NAME } from "@/lib/brand";
import { buildEmailConfirmationUrl } from "@/lib/auth/confirmation";

const GENERIC_MESSAGE =
  "Check your email for a one-time code and secure sign-in link. They expire soon and can only be used once.";
const RATE_LIMIT_MESSAGE =
  "A recent sign-in email is already on its way. Check all mail folders, then try again when the timer ends.";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimits = new Map<string, number[]>();

type RequestBody = {
  email?: unknown;
  mode?: unknown;
  next?: unknown;
};

function json(message = GENERIC_MESSAGE, status = 200, retryAfter?: number, reference?: string) {
  const response = NextResponse.json({ message, reference }, { status });
  response.headers.set("Cache-Control", "no-store");
  if (retryAfter) response.headers.set("Retry-After", String(retryAfter));
  return response;
}

function isEmail(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isRateLimited(key: string) {
  const now = Date.now();
  const recent = (rateLimits.get(key) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );
  recent.push(now);
  rateLimits.set(key, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

async function userExists(email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdminClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;
    if (data.users.some((user) => user.email?.toLowerCase() === email)) {
      return true;
    }
    if (data.users.length < 1000) return false;
  }

  throw new Error("Auth user lookup exceeded the supported page limit.");
}

function magicLinkEmail(confirmationLink: string, emailOtp: string, mode: "login" | "signup") {
  const safeLink = confirmationLink.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const heading =
    mode === "signup" ? `Welcome to ${PRODUCT_NAME}` : `Sign in to ${PRODUCT_NAME}`;
  const intro =
    mode === "signup"
      ? "Open Gorilla Ledger, then confirm once to finish creating your passwordless ledger."
      : "Open Gorilla Ledger, then confirm once to return to your ledger.";

  return `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;padding:32px 16px;background:#050505;color:#111111;font-family:Arial,sans-serif;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
          Your Gorilla Ledger sign-in code and secure link are ready. Use only the newest email.
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
          <tr>
            <td style="padding:0 0 16px;text-align:center;color:#ffffff;font-size:12px;letter-spacing:.16em;text-transform:uppercase;">
              ${PRODUCT_NAME}
            </td>
          </tr>
          <tr>
            <td style="padding:32px;border:1px solid #2b2b2b;border-radius:20px;background:#ffffff;">
              <p style="margin:0 0 8px;color:#686868;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">
                Secure account access
              </p>
              <h1 style="margin:0 0 12px;color:#111111;font-size:28px;line-height:1.2;">${heading}</h1>
              <p style="margin:0 0 24px;color:#454545;font-size:15px;line-height:1.6;">${intro}</p>
              <div style="margin:0 0 24px;padding:18px;border:1px solid #dedede;border-radius:14px;background:#f7f7f7;text-align:center;">
                <p style="margin:0 0 8px;color:#686868;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Sign-in code</p>
                <p style="margin:0;color:#111111;font-size:30px;font-weight:700;letter-spacing:.18em;">${emailOtp}</p>
                <p style="margin:10px 0 0;color:#686868;font-size:12px;line-height:1.5;">Enter this code on the computer where you started signing in.</p>
              </div>
              <p style="margin:0 0 24px;text-align:center;">
                <a href="${safeLink}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#050505;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
                  Open Gorilla Ledger
                </a>
              </p>
              <p style="margin:0 0 18px;color:#686868;font-size:12px;line-height:1.6;">
                On the next screen, select <strong>Continue securely</strong>. The code and link expire soon and can only be used once. If you requested more than one email, use only the newest email. If you did not request it, you can safely ignore this email.
              </p>
              <p style="margin:0;padding-top:18px;border-top:1px solid #e8e8e8;color:#8a8a8a;font-size:11px;">
                ${COMPANY_NAME}
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function magicLinkEmailText(confirmationLink: string, emailOtp: string, mode: "login" | "signup") {
  const action = mode === "signup" ? "Create your Gorilla Ledger account" : "Sign in to Gorilla Ledger";
  return `${action}\n\nSign-in code: ${emailOtp}\nEnter this code on the computer where you started signing in.\n\nOr open this secure link, then select Continue securely:\n${confirmationLink}\n\nThe code and link expire soon and can only be used once. If you requested more than one email, use only the newest email. If you did not request it, you can safely ignore this email.\n\n${COMPANY_NAME}`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  if (!body || !isEmail(body.email)) {
    return json("Enter a valid email address.", 400);
  }

  const email = body.email.trim().toLowerCase();
  const reference = crypto.randomUUID();
  const mode = body.mode === "signup" ? "signup" : "login";
  const next = sanitizeConfirmationDestination(
    typeof body.next === "string" ? body.next : undefined
  );
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || "unknown";

  if (
    isRateLimited(`email:${email}`) ||
    isRateLimited(`ip:${clientIp}`)
  ) {
    return json(RATE_LIMIT_MESSAGE, 429, RATE_LIMIT_WINDOW_MS / 1000, reference);
  }

  try {
    const exists = await userExists(email);
    if (mode === "login" && !exists) return json(GENERIC_MESSAGE, 200, undefined, reference);
    const deliveryMode: "login" | "signup" = exists ? "login" : "signup";

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://gl.savvyrilla.tech";
    const redirectTo = `${siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`;
    const { data, error } = exists
      ? await supabaseAdminClient.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo },
        })
      : await supabaseAdminClient.auth.admin.generateLink({
          type: "signup",
          email,
          password: crypto.randomUUID(),
          options: { redirectTo },
        });

    const tokenHash = data?.properties?.hashed_token;
    const emailOtp = data?.properties?.email_otp;
    const verificationType = data?.properties?.verification_type;
    if (error || !tokenHash || typeof emailOtp !== "string" || !/^\d{6,8}$/.test(emailOtp) || !verificationType) {
      console.error("[send-magic-link] Supabase link generation failed.", { reference });
      return json(GENERIC_MESSAGE, 200, undefined, reference);
    }

    // Fragments never reach preview requests, so mail scanners cannot redeem
    // this one-time token before the person confirms in their browser.
    const confirmationUrl = buildEmailConfirmationUrl({
      siteUrl,
      next,
      tokenHash,
      type: verificationType,
    });

    const delivery = await sendEmail({
      to: email,
      subject:
        deliveryMode === "signup"
          ? `Your ${PRODUCT_NAME} account code and link`
          : `Your ${PRODUCT_NAME} sign-in code and link`,
      html: magicLinkEmail(confirmationUrl, emailOtp, deliveryMode),
      text: magicLinkEmailText(confirmationUrl, emailOtp, deliveryMode),
      idempotencyKey: `auth/${reference}`,
    });

    if (!delivery.success) {
      console.error("[send-magic-link] Resend delivery failed.", { reference });
    } else {
      console.info("[send-magic-link] Delivery accepted.", {
        reference,
        deliveryId: delivery.data?.id,
      });
    }

    return json(GENERIC_MESSAGE, 200, undefined, reference);
  } catch {
    console.error("[send-magic-link] Unexpected delivery failure.", { reference });
    return json(GENERIC_MESSAGE, 200, undefined, reference);
  }
}
