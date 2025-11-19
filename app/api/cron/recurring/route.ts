// app/api/cron/recurring/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";

// Match your recurring_rules schema
type RecurringRule = {
  id: string;
  user_id: string;
  wallet_id: string;
  category_id: string | null;
  amount_minor: number;
  currency_code: string;
  type: string; // "income" | "expense" | etc.
  description: string | null;

  frequency: "daily" | "weekly" | "monthly";
  interval: number | null;
  day_of_month: number | null;
  day_of_week: number | null;

  start_date: string | null; // date (YYYY-MM-DD)
  end_date: string | null;   // date (YYYY-MM-DD)

  next_run_at: string;       // timestamptz
  is_active: boolean;

  created_at: string;
  updated_at: string;
};

type Frequency = RecurringRule["frequency"];

export const dynamic = "force-dynamic";

// Move next_run_at forward based on frequency + interval
function advanceNextRunAt(
  currentIso: string,
  frequency: Frequency,
  interval: number | null
): string {
  const step = interval && interval > 0 ? interval : 1;
  const d = new Date(currentIso); // current next_run_at

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

  return d.toISOString(); // timestamptz
}

export async function POST(_req: NextRequest) {
  const supabase = supabaseAdminClient;

  const now = new Date();
  const nowIso = now.toISOString();          // for next_run_at (timestamptz)
  const todayStr = nowIso.slice(0, 10);      // "YYYY-MM-DD" for occurred_on

  // 1️⃣ Load all due, active rules
  const { data: rules, error: rulesError } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true });

  if (rulesError) {
    console.error("[cron/recurring] Failed to load rules:", rulesError);
    return NextResponse.json(
      { error: "Failed to load recurring rules" },
      { status: 500 }
    );
  }

  if (!rules || rules.length === 0) {
    return NextResponse.json({
      date: todayStr,
      processed: 0,
      created: 0,
      updated: 0,
      message: "No recurring rules due at this time",
    });
  }

  // Optional: respect start_date / end_date windows
  const activeWindowRules = (rules as RecurringRule[]).filter((r) => {
    const today = todayStr;
    if (r.start_date && today < r.start_date) return false;
    if (r.end_date && today > r.end_date) return false;
    return true;
  });

  let createdCount = 0;
  let updatedCount = 0;

  for (const rule of activeWindowRules) {
    // 2️⃣ Insert a concrete transaction for this rule
    const { error: insertError } = await supabase.from("transactions").insert({
      user_id: rule.user_id,
      wallet_id: rule.wallet_id,
      category_id: rule.category_id,
      amount_minor: rule.amount_minor,
      currency_code: rule.currency_code,
      type: rule.type,
      occurred_on: todayStr,           // your transaction date
      description: rule.description,
    });

    if (insertError) {
      console.error(
        `[cron/recurring] Failed to create transaction for rule ${rule.id}:`,
        insertError
      );
      // Skip advancing next_run_at so we can retry next run
      continue;
    }

    createdCount += 1;

    // 3️⃣ Advance the rule's next_run_at
    const nextRunAt = advanceNextRunAt(
      rule.next_run_at,
      rule.frequency,
      rule.interval
    );

    const { error: updateError } = await supabase
      .from("recurring_rules")
      .update({
        next_run_at: nextRunAt,
        // If you later add a last_run_at column, you can also set: last_run_at: nowIso
      })
      .eq("id", rule.id);

    if (updateError) {
      console.error(
        `[cron/recurring] Failed to update next_run_at for rule ${rule.id}:`,
        updateError
      );
      continue;
    }

    updatedCount += 1;
  }

  return NextResponse.json({
    date: todayStr,
    processed: activeWindowRules.length,
    created: createdCount,
    updated: updatedCount,
  });
}

// Allow GET for manual testing from browser
export async function GET(req: NextRequest) {
  return POST(req);
}
