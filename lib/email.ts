import { Resend } from "resend";
import { PRODUCT_NAME } from "@/lib/brand";

const resend = new Resend(process.env.RESEND_API_KEY || "");

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailArgs) {
  try {
    const { data, error } = await resend.emails.send({
      from: `${PRODUCT_NAME} <no-reply@savvyrilla.tech>`,
      to,
      subject,
      html,
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
