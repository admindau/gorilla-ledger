"use server";

import WelcomeEmail from "@/emails/WelcomeEmail";
import { sendEmail } from "@/lib/email";

export async function sendWelcomeEmail(userEmail: string) {
  return await sendEmail({
    to: userEmail,
    subject: "Welcome to Gorilla Ledger 🦍🔥",
    react: WelcomeEmail(),
  });
}
