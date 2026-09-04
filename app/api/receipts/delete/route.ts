import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServiceClient } from "@/lib/supabase/service";
import { getLedgerAccessForOwner } from "@/lib/family/access";

type Body = { receipt_id: string };

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json(
      { error: "Missing Authorization: Bearer <access_token>." },
      { status: 401 }
    );
  }

  const body = (await req.json()) as Partial<Body>;
  if (!body.receipt_id) {
    return NextResponse.json({ error: "Missing receipt_id." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  const supabaseAuth = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: uErr,
  } = await supabaseAuth.auth.getUser();

  if (uErr || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = user.id;
  const supabase = supabaseServiceClient();

  const { data: receipt, error: rErr } = await supabase
    .from("receipts")
    .select("id, user_id, storage_path")
    .eq("id", body.receipt_id)
    .single();

  if (rErr || !receipt) {
    if (rErr) console.error("[receipt-delete] Lookup failed.", { code: rErr.code });
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  const access = await getLedgerAccessForOwner(userId, receipt.user_id);
  if (!access || access.role === "viewer") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const bucket = "receipts";
  const { error: sErr } = await supabase.storage
    .from(bucket)
    .remove([receipt.storage_path]);

  if (sErr) {
    console.error("[receipt-delete] Storage removal failed.", { name: sErr.name });
    return NextResponse.json({ error: "Unable to remove this receipt. Try again." }, { status: 500 });
  }

  const { error: dErr } = await supabase.from("receipts").delete().eq("id", receipt.id);

  if (dErr) {
    console.error("[receipt-delete] Record removal failed.", { code: dErr.code });
    return NextResponse.json({ error: "Receipt storage was cleared, but the record needs support review." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
