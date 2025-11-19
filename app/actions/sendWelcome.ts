"use server";

import { sendEmail } from "@/lib/email";

export async function sendWelcome(userEmail: string) {
  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #ffffff; color: #000000; padding: 24px;">
        <div style="max-width: 480px; margin: 0 auto; border: 1px solid #e5e5e5; border-radius: 12px; padding: 24px;">
          <h2 style="margin-bottom: 12px; font-size: 20px;">
            Welcome to Gorilla Ledger 🦍🔥
          </h2>
          <p style="font-size: 14px; margin-bottom: 16px; line-height: 1.5;">
            Your financial jungle just got smarter.
          </p>
          <p style="font-size: 14px; margin-bottom: 16px; line-height: 1.5;">
            Track wallets, budgets, transactions and much more — all in one clean, focused place.
          </p>
          <p style="font-size: 12px; color: #555555; line-height: 1.5;">
            Respect,<br />
            <strong>Savvy Rilla / Savvy Gorilla Technologies</strong>
          </p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: userEmail,
    subject: "Welcome to Gorilla Ledger 🦍🔥",
    html,
  });
}
