"use server";

import { sendEmail } from "@/lib/email";
import { PRODUCT_NAME, PRODUCT_SIGNATURE } from "@/lib/brand";

export async function sendWelcome(userEmail: string) {
  const html = `
    <html>
      <body style="margin:0; padding:24px; background-color:#000000; font-family: Arial, sans-serif; color:#000000;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; margin:0 auto;">
          <tr>
            <td align="center" style="padding-bottom:16px;">
              <div style="display:inline-block; padding:8px 14px; border-radius:999px; border:1px solid #333333; background:#000000; color:#ffffff; font-size:11px; letter-spacing:0.08em; text-transform:uppercase;">
                ${PRODUCT_NAME}
              </div>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff; border-radius:16px; padding:24px; border:1px solid #222222;">
              <h2 style="margin:0 0 12px; font-size:22px; color:#000000;">
                Welcome to ${PRODUCT_NAME}
              </h2>

              <p style="margin:0 0 12px; font-size:14px; line-height:1.6; color:#111111;">
                Your account is ready. You can now track wallets, income, expenses,
                budgets, and recurring activity in one focused space.
              </p>

              <p style="margin:0 0 18px; font-size:14px; line-height:1.6; color:#111111;">
                Start by adding your first wallet, then record a few transactions to build
                a clear view of your finances.
              </p>

              <p style="margin:0 0 24px; font-size:12px; line-height:1.6; color:#555555;">
                If you didn&apos;t create this account, you can safely ignore this email.
              </p>

              <hr style="border:none; border-top:1px solid #eeeeee; margin:0 0 12px;" />

              <p style="margin:0; font-size:11px; color:#888888;">
                ${PRODUCT_SIGNATURE}
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendEmail({
    to: userEmail,
    subject: `Welcome to ${PRODUCT_NAME}`,
    html,
  });
}
