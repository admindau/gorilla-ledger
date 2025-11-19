import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    console.log("[send-reset] route hit");

    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://gl.savvyrilla.tech";

    const supabaseUrl =
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error(
        "[send-reset] Missing Supabase env vars: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      );
      return NextResponse.json(
        {
          message:
            "If this email exists in our system, a reset link has been sent.",
        },
        { status: 200 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${baseUrl}/auth/update-password`,
      },
    });

    if (error || !data?.properties?.action_link) {
      console.error("[send-reset] generateLink error:", error, data);
      return NextResponse.json(
        {
          message:
            "If this email exists in our system, a reset link has been sent.",
        },
        { status: 200 }
      );
    }

    const resetLink = data.properties.action_link;
    console.log("[send-reset] got resetLink");

    const html = `
      <html>
        <body style="margin:0; padding:24px; background-color:#000000; font-family: Arial, sans-serif; color:#000000;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; margin:0 auto;">
            <tr>
              <td align="center" style="padding-bottom:16px;">
                <div style="display:inline-block; padding:8px 14px; border-radius:999px; border:1px solid #333333; background:#000000; color:#ffffff; font-size:11px; letter-spacing:0.08em; text-transform:uppercase;">
                  Gorilla Ledger™
                </div>
              </td>
            </tr>

            <tr>
              <td style="background:#ffffff; border-radius:16px; padding:24px; border:1px solid #222222;">
                <h2 style="margin:0 0 12px; font-size:22px; color:#000000;">
                  Reset your Gorilla Ledger™ password
                </h2>

                <p style="margin:0 0 12px; font-size:14px; line-height:1.6; color:#111111;">
                  You requested to reset the password for your Gorilla Ledger™ account.
                  Click the button below to choose a new password.
                </p>

                <p style="margin:0 0 20px; text-align:center;">
                  <a href="${resetLink}"
                     style="display:inline-block; padding:10px 22px; border-radius:999px;
                            background:#000000; color:#ffffff; text-decoration:none;
                            font-size:14px; font-weight:bold;">
                    Reset Password
                  </a>
                </p>

                <p style="margin:0 0 16px; font-size:12px; line-height:1.6; color:#555555; word-break:break-all;">
                  If the button doesn&apos;t work, copy and paste this link into your browser:
                  <br />
                  ${resetLink}
                </p>

                <p style="margin:0 0 16px; font-size:12px; line-height:1.6; color:#555555;">
                  If you did not request this, you can safely ignore this email. Your password will stay the same.
                </p>

                <hr style="border:none; border-top:1px solid #eeeeee; margin:0 0 12px;" />

                <p style="margin:0; font-size:11px; color:#888888;">
                  Gorilla Ledger™ • Built by Savvy Rilla / Savvy Gorilla Technologies • savvyrilla.tech
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const result = await sendEmail({
      to: email,
      subject: "Reset Your Gorilla Ledger™ Password",
      html,
    });

    console.log("[send-reset] sendEmail result:", result);

    return NextResponse.json(
      {
        message:
          "If this email exists in our system, a reset link has been sent.",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[send-reset] route error:", err);

    return NextResponse.json(
      {
        message:
          "If this email exists in our system, a reset link has been sent.",
      },
      { status: 200 }
    );
  }
}
