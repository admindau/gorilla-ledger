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

    // 🔥 Build plain HTML email
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; background-color: #ffffff; color: #000000; padding: 24px;">
          <div style="max-width: 480px; margin: 0 auto; border: 1px solid #e5e5e5; border-radius: 12px; padding: 24px;">
            <h2 style="margin-bottom: 12px; font-size: 20px;">
              Reset your Gorilla Ledger™ password
            </h2>
            <p style="font-size: 14px; margin-bottom: 16px; line-height: 1.5;">
              You requested to reset the password for your Gorilla Ledger™ account.
              Click the button below to choose a new password.
            </p>
            <p style="text-align: center; margin-bottom: 24px;">
              <a href="${resetLink}"
                 style="display: inline-block; padding: 10px 20px; border-radius: 6px;
                        background-color: #000000; color: #ffffff; text-decoration: none;
                        font-weight: bold; font-size: 14px;">
                Reset Password
              </a>
            </p>
            <p style="font-size: 12px; color: #555555; line-height: 1.5; word-break: break-all;">
              If the button doesn't work, copy and paste this link into your browser:
              <br />
              ${resetLink}
            </p>
            <hr style="margin: 24px 0 12px; border: none; border-top: 1px solid #eeeeee;" />
            <p style="font-size: 11px; color: #999999;">
              Gorilla Ledger™ • savvyrilla.tech
            </p>
          </div>
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
