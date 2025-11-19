import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import ResetPasswordEmail from "@/emails/ResetPasswordEmail";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    console.log("[send-reset] route hit"); // debug

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

    const result = await sendEmail({
      to: email,
      subject: "Reset Your Gorilla Ledger™ Password",
      react: ResetPasswordEmail({ resetLink }),
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
