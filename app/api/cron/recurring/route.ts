// app/api/cron/recurring/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";

// If you only support "monthly" for now, that's fine – just keep "monthly".
type Frequency = "daily" | "weekly" | "monthly";

type RecurringRule = {
  id: string;
  user_id: string;
  wallet_id: string;
  category_id: string | null;
  amount_minor: number; // adjust to "amount" if your column is named that
  description: string | null;
  frequency: Frequency;
  interval: number | null; // e.g. every 1 month, every 2 weeks, etc.
  next_run_date: string; // ISO date string "YYYY-MM-DD"
  is_paused: boolean;
};

// Utility: add interval to a date string (YYYY-MM-DD) according to frequency
function advanceDate(
  dateStr: string,
  frequency: Frequency,
  interval: number | null
): string {
  const step = interval && interval > 0 ? interval : 1;
  const d = new Date(`${dateStr}T00:00:00.000Z`);

  switch (frequency) {
    case "daily":
      d.setUTCDate(d.getUTCDate() + step);
      break;
    case "weekly":
      d.setUTCDate(d.getUTCDate() + step * 7);
      break;
    case "monthly":
    default:
      d.setUTCMonth(d.getUTCMonth() + step);
      break;
  }

  // Return back as "YYYY-MM-DD"
  return d.toISOString().slice(0, 10);
}

// Make sure this route is always executed dynamically (no static caching)
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const supabase = supabaseAdminClient;

  // Use "today" in UTC so Vercel cron + DB comparisons are consistent
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10); // "YYYY-MM-DD"

  // 1️⃣ Load all due rules (not paused, next_run_date <= today)
  const { data: rules, error: rulesError } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("is_paused", false)
    .lte("next_run_date", todayStr);

  if (rulesError) {
    console.error("[cron/recurring] Failed to load rules:", rulesError);
    return NextResponse.json(
      { error: "Failed to load recurring rules" },
      { status: 500 }
    );
  }

  if (!rules || rules.length === 0) {
    return NextResponse.json({
      processed: 0,
      created: 0,
      updated: 0,
      message: "No recurring rules due today",
      date: todayStr,
    });
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const rule of rules as RecurringRule[]) {
    // 2️⃣ Insert a transaction instance for this rule
    // NOTE: adjust column names if your "transactions" table is different
    const { error: insertError } = await supabase.from("transactions").insert({
      user_id: rule.user_id,
      wallet_id: rule.wallet_id,
      category_id: rule.category_id,
      amount_minor: rule.amount_minor, // change to "amount" if needed
      // If your table needs a date column, this is typically "occurred_on"
      occurred_on: todayStr,
      description: rule.description,
      // Optional columns – uncomment / adjust only if they exist:
      // is_recurring_instance: true,
      // recurring_rule_id: rule.id,
    });

    if (insertError) {
      console.error(
        `[cron/recurring] Failed to create transaction for rule ${rule.id}:`,
        insertError
      );
      // Skip updating next_run_date for this rule so we can retry next run
      continue;
    }

    createdCount += 1;

    // 3️⃣ Advance the next_run_date for the rule
    const nextRunDate = advanceDate(
      rule.next_run_date,
      rule.frequency,
      rule.interval
    );

    const { error: updateError } = await supabase
      .from("recurring_rules")
      .update({
        next_run_date: nextRunDate,
        // Optional: if your table has this column:
        // last_run_date: todayStr,
      })
      .eq("id", rule.id);

    if (updateError) {
      console.error(
        `[cron/recurring] Failed to update next_run_date for rule ${rule.id}:`,
        updateError
      );
      continue;
    }

    updatedCount += 1;
  }

  return NextResponse.json({
    date: todayStr,
    processed: rules.length,
    created: createdCount,
    updated: updatedCount,
  });
}

// Optional: GET for manual testing from the browser or curl
export async function GET(req: NextRequest) {
  return POST(req);
}
