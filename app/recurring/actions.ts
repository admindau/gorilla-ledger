"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

// Admin client using service role – same envs you already use for cron
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

function toMinor(amount: number) {
  return Math.round(amount * 100);
}

export async function createRecurringRule(formData: FormData) {
  try {
    // 1) Read raw form values
    const wallet_id = String(formData.get("wallet_id") ?? "").trim();
    const category_id = String(formData.get("category_id") ?? "").trim();
    const amountRaw = String(formData.get("amount") ?? "").trim();
    const date = String(formData.get("date") ?? "").trim();
    const descRaw = formData.get("description");
    const description =
      descRaw === null || descRaw === undefined
        ? null
        : String(descRaw).trim() || null;

    if (!wallet_id || !category_id || !amountRaw || !date) {
      console.error("Missing required fields", {
        wallet_id,
        category_id,
        amountRaw,
        date,
      });
      throw new Error("Missing required fields");
    }

    const amount = Number(amountRaw);
    if (!Number.isFinite(amount)) {
      console.error("Invalid amount", { amountRaw });
      throw new Error("Invalid amount");
    }

    // 2) Look up wallet to get user_id + currency_code
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("id, user_id, currency_code")
      .eq("id", wallet_id)
      .single();

    if (walletError || !wallet) {
      console.error("Wallet lookup failed:", walletError);
      throw new Error("Invalid wallet");
    }

    // 3) Compute schedule fields
    const firstRun = new Date(date);
    const dayOfMonth = firstRun.getUTCDate();

    // 4) Insert recurring rule
    const { error: insertError } = await supabaseAdmin
      .from("recurring_rules")
      .insert({
        user_id: wallet.user_id,
        wallet_id,
        category_id,
        type: "expense",
        amount_minor: toMinor(amount),
        currency_code: wallet.currency_code,
        frequency: "monthly",
        interval: 1,
        day_of_month: dayOfMonth,
        start_date: date,
        next_run_at: date,
        description,
        is_active: true,
      });

    if (insertError) {
      console.error("Recurring insert failed:", insertError);
      throw new Error(insertError.message || "Insert failed");
    }

    // 5) Refresh the recurring page so the new rule shows up
    revalidatePath("/recurring");
  } catch (err) {
    console.error("createRecurringRule failed:", err);
    // rethrow so your UI shows the failure toast
    throw err;
  }
}
