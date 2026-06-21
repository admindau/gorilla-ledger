// app/api/cron/recurring/route.ts

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Match your recurring_rules schema.
 */
type RecurringRule = {
  id: string;
  user_id: string;
  wallet_id: string;
  category_id: string | null;
  amount_minor: number;
  currency_code: string;
  type: string;
  description: string | null;

  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number | null;
  day_of_month: number | null;
  day_of_week: number | null;

  start_date: string | null; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD

  next_run_at: string; // timestamptz
  is_active: boolean;
  last_run_at: string | null;
  total_runs: number;

  created_at: string;
  updated_at: string;
};

type Frequency = RecurringRule["frequency"];
type RunLogStatus = "success" | "failed" | "skipped";

export const dynamic = "force-dynamic";

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function getCronSecretFromHeaders(req: NextRequest): string | null {
  const h =
    req.headers.get("x-cron-secret") ||
    req.headers.get("X-CRON-SECRET") ||
    req.headers.get("authorization") ||
    req.headers.get("Authorization");

  if (!h) return null;
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return h.trim();
}

function isAuthorizedCron(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided = getCronSecretFromHeaders(req);
  if (!provided) return false;
  return constantTimeEquals(provided, expected);
}

function advanceNextRunAt(
  currentIso: string,
  frequency: Frequency,
  interval: number | null
): string {
  const step = interval && interval > 0 ? interval : 1;
  const d = new Date(currentIso);

  switch (frequency) {
    case "daily":
      d.setUTCDate(d.getUTCDate() + step);
      break;
    case "weekly":
      d.setUTCDate(d.getUTCDate() + step * 7);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + step);
      break;
    case "yearly":
    default:
      d.setUTCFullYear(d.getUTCFullYear() + step);
      break;
  }

  return d.toISOString();
}

async function writeRunLog(input: {
  ruleId: string;
  userId: string;
  transactionId?: string | null;
  status: RunLogStatus;
  details?: string | null;
}) {
  const { error } = await supabaseAdminClient.from("recurring_run_logs").insert({
    rule_id: input.ruleId,
    user_id: input.userId,
    transaction_id: input.transactionId ?? null,
    status: input.status,
    details: input.details ?? null,
  });

  if (error) {
    // Logging must never break the cron worker itself.
    console.error(
      `[cron/recurring] Failed to write run log for rule ${input.ruleId}:`,
      error
    );
  }
}

async function handler(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = supabaseAdminClient;

  const now = new Date();
  const nowIso = now.toISOString();
  const todayStr = nowIso.slice(0, 10);

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
    return NextResponse.json(
      {
        date: todayStr,
        processed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        message: "No recurring rules due at this time",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let processedCount = 0;

  for (const rule of rules as RecurringRule[]) {
    processedCount += 1;

    if (rule.start_date && todayStr < rule.start_date) {
      skippedCount += 1;
      await writeRunLog({
        ruleId: rule.id,
        userId: rule.user_id,
        status: "skipped",
        details: `Rule skipped because start date ${rule.start_date} is in the future.`,
      });
      continue;
    }

    if (rule.end_date && todayStr > rule.end_date) {
      skippedCount += 1;
      await writeRunLog({
        ruleId: rule.id,
        userId: rule.user_id,
        status: "skipped",
        details: `Rule skipped because end date ${rule.end_date} has passed.`,
      });
      continue;
    }

    const dueAtIso = new Date(rule.next_run_at).toISOString();

    const { data: existingTx, error: exErr } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", rule.user_id)
      .eq("wallet_id", rule.wallet_id)
      .eq("amount_minor", rule.amount_minor)
      .eq("currency_code", rule.currency_code)
      .eq("type", rule.type)
      .eq("occurred_at", dueAtIso)
      .maybeSingle();

    if (exErr) {
      failedCount += 1;
      console.error(
        `[cron/recurring] Idempotency check failed for rule ${rule.id}:`,
        exErr
      );
      await writeRunLog({
        ruleId: rule.id,
        userId: rule.user_id,
        status: "failed",
        details: `Idempotency check failed: ${exErr.message}`,
      });
      continue;
    }

    let transactionId: string | null = existingTx?.id ?? null;
    let logStatus: RunLogStatus = existingTx?.id ? "skipped" : "success";
    let logDetails = existingTx?.id
      ? `Transaction already existed for scheduled run ${dueAtIso}. Rule advanced without creating a duplicate.`
      : `Transaction created for scheduled run ${dueAtIso}.`;

    if (!existingTx?.id) {
      const { data: insertedTx, error: insertError } = await supabase
        .from("transactions")
        .insert({
          user_id: rule.user_id,
          wallet_id: rule.wallet_id,
          category_id: rule.category_id,
          amount_minor: rule.amount_minor,
          currency_code: rule.currency_code,
          type: rule.type,
          description: rule.description,
          occurred_at: dueAtIso,
        })
        .select("id")
        .single();

      if (insertError) {
        failedCount += 1;
        console.error(
          `[cron/recurring] Failed to create tx for rule ${rule.id}:`,
          insertError
        );
        await writeRunLog({
          ruleId: rule.id,
          userId: rule.user_id,
          status: "failed",
          details: `Transaction insert failed: ${insertError.message}`,
        });
        continue;
      }

      transactionId = insertedTx?.id ?? null;
      createdCount += 1;
    } else {
      skippedCount += 1;
    }

    const nextRunAt = advanceNextRunAt(
      rule.next_run_at,
      rule.frequency,
      rule.interval
    );

    const { error: updateError } = await supabase
      .from("recurring_rules")
      .update({
        next_run_at: nextRunAt,
        last_run_at: dueAtIso,
        total_runs: (rule.total_runs ?? 0) + 1,
      })
      .eq("id", rule.id);

    if (updateError) {
      failedCount += 1;
      logStatus = "failed";
      logDetails = `Rule update failed after transaction handling: ${updateError.message}`;
      console.error(
        `[cron/recurring] Failed to update next_run_at for rule ${rule.id}:`,
        updateError
      );
      await writeRunLog({
        ruleId: rule.id,
        userId: rule.user_id,
        transactionId,
        status: logStatus,
        details: logDetails,
      });
      continue;
    }

    updatedCount += 1;

    await writeRunLog({
      ruleId: rule.id,
      userId: rule.user_id,
      transactionId,
      status: logStatus,
      details: logDetails,
    });
  }

  return NextResponse.json(
    {
      date: todayStr,
      processed: processedCount,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      failed: failedCount,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
