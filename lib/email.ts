import React from "react";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "");

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: React.ReactElement;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: "Gorilla Ledger <no-reply@savvyrilla.tech>",
      to,
      subject,
      react,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (e) {
    console.error("Resend exception:", e);
    return { success: false, error: e };
  }
}
