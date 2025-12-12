import { NextResponse } from "next/server";
import { supabaseServiceClient } from "@/lib/supabase/service";

type Body = { receipt_id: string };

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Body>;
  if (!body.receipt_id) {
    return NextResponse.json({ error: "Missing receipt_id." }, { status: 400 });
  }

  const supabase = supabaseServiceClient();

  // Load receipt (includes path + user_id)
  const { data: receipt, error: rErr } = await supabase
    .from("receipts")
    .select("id, user_id, transaction_id, storage_path")
    .eq("id", body.receipt_id)
    .single();

  if (rErr || !receipt) {
    return NextResponse.json(
      { error: rErr?.message ?? "Receipt not found." },
      { status: 404 }
    );
  }

  // Delete storage object
  const bucket = "receipts";
  const { error: sErr } = await supabase.storage
    .from(bucket)
    .remove([receipt.storage_path]);

  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  // Delete DB row
  const { error: dErr } = await supabase
    .from("receipts")
    .delete()
    .eq("id", receipt.id);

  if (dErr) {
    return NextResponse.json({ error: dErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
