import { Resend } from "resend";
import { PRODUCT_NAME, SUPPORT_EMAIL } from "@/lib/brand";

const resend = new Resend(process.env.RESEND_API_KEY || "");

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
};

export async function sendEmail({ to, subject, html, text, idempotencyKey }: SendEmailArgs) {
  const deliveryKey = idempotencyKey ?? `email/${crypto.randomUUID()}`;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { data, error } = await resend.emails.send(
        {
          from: `${PRODUCT_NAME} <${SUPPORT_EMAIL}>`,
          replyTo: SUPPORT_EMAIL,
          to,
          subject,
          html,
          text,
        },
        { idempotencyKey: deliveryKey }
      );

      if (!error) return { success: true, data };

      if (attempt === 2) {
        console.error("Resend error after retry:", error);
        return { success: false, error };
      }
    } catch (error) {
      if (attempt === 2) {
        console.error("Resend exception after retry:", error);
        return { success: false, error };
      }
    }
  }

  return { success: false, error: new Error("Email delivery did not complete") };
}
