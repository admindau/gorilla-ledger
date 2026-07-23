import { NextRequest, NextResponse } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeConfirmationDestination } from "@/lib/auth/navigation";
import { sendEmail } from "@/lib/email";
import { COMPANY_NAME, PRODUCT_NAME } from "@/lib/brand";

const GENERIC_MESSAGE =
  "Check your email for a secure sign-in link. It expires soon and can only be used once.";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimits = new Map<string, number[]>();

type RequestBody = {
  email?: unknown;
  mode?: unknown;
  next?: unknown;
};

function json(message = GENERIC_MESSAGE, status = 200) {
  const response = NextResponse.json({ message }, { status });
  response.headers.set("Cache-Control", "no-store");
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

function magicLinkEmail(actionLink: string, mode: "login" | "signup") {
  const safeLink = actionLink.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const heading =
    mode === "signup" ? `Welcome to ${PRODUCT_NAME}` : `Sign in to ${PRODUCT_NAME}`;
  const intro =
    mode === "signup"
      ? "Use this secure link to finish creating your passwordless ledger."
      : "Use this secure, one-time link to return to your ledger.";

  return `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;padding:32px 16px;background:#050505;color:#111111;font-family:Arial,sans-serif;">
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
              <p style="margin:0 0 24px;text-align:center;">
                <a href="${safeLink}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#050505;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
                  Open Gorilla Ledger
                </a>
              </p>
              <p style="margin:0 0 18px;color:#686868;font-size:12px;line-height:1.6;">
                This link expires soon and can only be used once. If you did not request it, you can safely ignore this email.
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

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  if (!body || !isEmail(body.email)) {
    return json("Enter a valid email address.", 400);
  }

  const email = body.email.trim().toLowerCase();
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
    return json(GENERIC_MESSAGE, 429);
  }

  try {
    const exists = await userExists(email);
    if (mode === "login" && !exists) return json();

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

    const actionLink = data?.properties?.action_link;
    if (error || !actionLink) {
      console.error("[send-magic-link] Supabase link generation failed.");
      return json();
    }

    const delivery = await sendEmail({
      to: email,
      subject:
        mode === "signup"
          ? `Finish setting up ${PRODUCT_NAME}`
          : `Your ${PRODUCT_NAME} sign-in link`,
      html: magicLinkEmail(actionLink, mode),
    });

    if (!delivery.success) {
      console.error("[send-magic-link] Resend delivery failed.");
    }

    return json();
  } catch {
    console.error("[send-magic-link] Unexpected delivery failure.");
    return json();
  }
}
