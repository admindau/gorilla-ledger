import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServiceClient } from "@/lib/supabase/service";

type Body = {
  transaction_id: string;
  receipt_id: string;
  ext: string; // e.g. "pdf", "jpg"
};

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function cleanExt(ext: string): string {
  const x = ext.replace(".", "").toLowerCase();
  return x.replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
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
  if (!body.transaction_id || !body.receipt_id || !body.ext) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
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
  const bucket = "receipts";
  const ext = cleanExt(body.ext);

  const supabase = supabaseServiceClient();

  const { data: receipt, error: rErr } = await supabase
    .from("receipts")
    .select("id, user_id, transaction_id")
    .eq("id", body.receipt_id)
    .single();

  if (rErr || !receipt) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  if (receipt.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (receipt.transaction_id !== body.transaction_id) {
    return NextResponse.json(
      { error: "Receipt/transaction mismatch." },
      { status: 400 }
    );
  }

  const path = `${userId}/${body.transaction_id}/${body.receipt_id}.${ext}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data?.token) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create signed upload URL." },
      { status: 500 }
    );
  }

  return NextResponse.json({ bucket, path, token: data.token }, { status: 200 });
}
