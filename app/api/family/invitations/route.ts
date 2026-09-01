import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { PRODUCT_NAME } from "@/lib/brand";
import { applyPrivateNoStore } from "@/lib/http/privateCache";

type InvitationResult = {
  invitation_id: string;
  invitation_token: string;
  ledger_name: string;
};

function response(body: object, status = 200) {
  const result = NextResponse.json(body, { status });
  applyPrivateNoStore(result.headers);
  return result;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return response({ error: "Unauthorized." }, 401);

  const body = await request.json().catch(() => null) as { email?: unknown; role?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body?.role === "viewer" ? "viewer" : "editor";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response({ error: "Enter a valid email address." }, 400);
  }

  const { data: rawData, error } = await supabase
    .rpc("create_ledger_invitation", { p_email: email, p_role: role })
    .single();
  const data = rawData as InvitationResult | null;

  if (error || !data) {
    const message = error?.message ?? "";
    const invitationError = message.includes("already the owner")
      ? "You already own this ledger. Invite a different email address."
      : message.includes("Wait before")
        ? "Please wait a moment before sending another invitation."
        : message.includes("Invitation limit")
          ? "You’ve reached the hourly invitation limit. Try again later."
          : "Unable to create the invitation. Check the email address and try again.";
    return response({ error: invitationError }, 400);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gl.savvyrilla.tech";
  const inviteUrl = `${siteUrl}/invite?token=${encodeURIComponent(data.invitation_token)}`;
  const safeLedgerName = escapeHtml(data.ledger_name || "a Gorilla Ledger household");
  const safeInviteUrl = escapeHtml(inviteUrl);
  const delivery = await sendEmail({
    to: email,
    subject: `You’re invited to ${data.ledger_name || PRODUCT_NAME}`,
    html: `
      <!doctype html>
      <html><body style="margin:0;padding:32px 16px;background:#050505;font-family:Arial,sans-serif;color:#111">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
          <tr><td style="padding:0 0 16px;text-align:center;color:#fff;font-size:12px;letter-spacing:.16em;text-transform:uppercase">${PRODUCT_NAME}</td></tr>
          <tr><td style="padding:32px;border-radius:20px;background:#fff">
            <p style="margin:0 0 8px;color:#686868;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">Family access</p>
            <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2">Work on the household ledger together</h1>
            <p style="margin:0 0 24px;color:#454545;font-size:15px;line-height:1.6">You’ve been invited as a ${role} of <strong>${safeLedgerName}</strong>. Use your own secure account to ${role === "viewer" ? "review the household ledger without changing it" : "help manage transactions, wallets, budgets, receipts, and recurring entries"}.</p>
            <p style="margin:0 0 24px;text-align:center"><a href="${safeInviteUrl}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#050505;color:#fff;font-size:14px;font-weight:700;text-decoration:none">Accept invitation</a></p>
            <p style="margin:0;color:#686868;font-size:12px;line-height:1.6">This single-use invitation expires in seven days. If you weren’t expecting it, you can ignore this email.</p>
          </td></tr>
        </table>
      </body></html>`,
  });

  if (!delivery.success) {
    await supabase.rpc("revoke_ledger_invitation", { p_invitation_id: data.invitation_id });
    return response({ error: "The invitation could not be delivered. Please try again." }, 502);
  }

  return response({ message: `Invitation sent to ${email}.` }, 201);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return response({ error: "Unauthorized." }, 401);
  const body = await request.json().catch(() => null) as { invitation_id?: unknown } | null;
  if (typeof body?.invitation_id !== "string") return response({ error: "Invitation ID is required." }, 400);
  const { error } = await supabase.rpc("revoke_ledger_invitation", { p_invitation_id: body.invitation_id });
  return error ? response({ error: error.message }, 400) : response({ message: "Invitation revoked." });
}
