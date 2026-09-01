import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeConfirmationDestination } from "@/lib/auth/navigation";
import { sendEmail } from "@/lib/email";
import { COMPANY_NAME, PRODUCT_NAME } from "@/lib/brand";
import { createHmac } from "node:crypto";

const GENERIC_MESSAGE =
  "Check your email for a one-time sign-in code. It expires soon and can only be used once.";
const RATE_LIMIT_MESSAGE =
  "A recent sign-in email is already on its way. Check all mail folders, then try again when the timer ends.";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

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

function privacySafeBucket(value: string) {
  const pepper = process.env.AUTH_RATE_LIMIT_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pepper) throw new Error("Authentication rate-limit pepper is not configured.");
  return createHmac("sha256", pepper).update(value).digest("hex");
}

async function consumeRateLimit(key: string, maxRequests: number) {
  const supabaseAdminClient = getSupabaseAdminClient();
  const { data, error } = await supabaseAdminClient.rpc("consume_auth_rate_limit", {
    p_bucket_hash: privacySafeBucket(key),
    p_window_seconds: RATE_LIMIT_WINDOW_MS / 1000,
    p_max_requests: maxRequests,
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  return {
    allowed: result?.allowed === true,
    retryAfter: Number(result?.retry_after_seconds) || 0,
  };
}

async function userExists(email: string) {
  const supabaseAdminClient = getSupabaseAdminClient();
  const { data, error } = await supabaseAdminClient.rpc("auth_user_exists", { p_email: email });
  if (error) throw error;
  return data === true;
}

function signInCodeEmail(emailOtp: string, mode: "login" | "signup", reference: string) {
  const heading =
    mode === "signup" ? `Welcome to ${PRODUCT_NAME}` : `Sign in to ${PRODUCT_NAME}`;
  const intro =
    mode === "signup"
      ? "Enter this one-time code in Gorilla Ledger to finish creating your passwordless ledger."
      : "Enter this one-time code in Gorilla Ledger to return to your ledger.";
  const instructions =
    mode === "signup"
      ? "Open Gorilla Ledger and select Create account. Enter the email address that received this message, then type the code under Already have an account code?"
      : "Open Gorilla Ledger and select Sign in. Enter the email address that received this message, then type the code under Already have a code?";

  return `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;padding:32px 16px;background:#050505;color:#111111;font-family:Arial,sans-serif;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
          Your Gorilla Ledger sign-in code is ready. Use only the newest email.
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
              <p style="margin:0 0 18px;color:#454545;font-size:13px;line-height:1.6;">${instructions}</p>
              <p style="margin:0 0 18px;color:#686868;font-size:12px;line-height:1.6;">
                The code expires soon and can only be used once. If you requested more than one email, use only the newest code. Gorilla Ledger will never ask you to forward or reply with this code. If you did not request it, you can safely ignore this email.
              </p>
              <p style="margin:0;padding-top:18px;border-top:1px solid #e8e8e8;color:#8a8a8a;font-size:11px;">
                ${COMPANY_NAME} · Request ${reference.slice(0, 8)} · ${new Date().toISOString()}
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function signInCodeEmailText(emailOtp: string, mode: "login" | "signup", reference: string) {
  const action = mode === "signup" ? "Create your Gorilla Ledger account" : "Sign in to Gorilla Ledger";
  const instructions = mode === "signup"
    ? "Open Gorilla Ledger and select Create account. Enter the email address that received this message, then type the code under Already have an account code?"
    : "Open Gorilla Ledger and select Sign in. Enter the email address that received this message, then type the code under Already have a code?";
  return `${action}\n\nSign-in code: ${emailOtp}\nEnter this code on the computer where you started signing in.\n\n${instructions}\n\nThe code expires soon and can only be used once. If you requested more than one email, use only the newest code. Gorilla Ledger will never ask you to forward or reply with this code. If you did not request it, you can safely ignore this email.\n\n${COMPANY_NAME}\nRequest ${reference.slice(0, 8)} · ${new Date().toISOString()}`;
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

  try {
    const supabaseAdminClient = getSupabaseAdminClient();
    const [emailLimit, ipLimit] = await Promise.all([
      consumeRateLimit(`send-code:email:${email}`, 5),
      consumeRateLimit(`send-code:ip:${clientIp}`, 20),
    ]);
    if (!emailLimit.allowed || !ipLimit.allowed) {
      return json(RATE_LIMIT_MESSAGE, 429, Math.max(emailLimit.retryAfter, ipLimit.retryAfter), reference);
    }

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

    const emailOtp = data?.properties?.email_otp;
    const verificationType = data?.properties?.verification_type;
    if (error || typeof emailOtp !== "string" || !/^\d{6,8}$/.test(emailOtp) || !verificationType) {
      console.error("[send-magic-link] Supabase link generation failed.", { reference });
      return json(GENERIC_MESSAGE, 200, undefined, reference);
    }

    const deliveryStartedAt = performance.now();
    const delivery = await sendEmail({
      to: email,
      subject:
        deliveryMode === "signup"
          ? `Your ${PRODUCT_NAME} account code`
          : `Your ${PRODUCT_NAME} sign-in code`,
      html: signInCodeEmail(emailOtp, deliveryMode, reference),
      text: signInCodeEmailText(emailOtp, deliveryMode, reference),
      idempotencyKey: `auth/${reference}`,
    });

    if (!delivery.success) {
      console.error("[send-magic-link] Resend delivery failed.", {
        reference,
        latencyMs: Math.round(performance.now() - deliveryStartedAt),
        failureClass: delivery.error instanceof Error ? delivery.error.name : "provider_error",
      });
    } else {
      console.info("[send-magic-link] Delivery accepted.", {
        reference,
        deliveryId: delivery.data?.id,
        latencyMs: Math.round(performance.now() - deliveryStartedAt),
      });
    }

    return json(GENERIC_MESSAGE, 200, undefined, reference);
  } catch {
    console.error("[send-magic-link] Unexpected delivery failure.", { reference });
    return json(GENERIC_MESSAGE, 200, undefined, reference);
  }
}
