import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServiceClient } from "@/lib/supabase/service";

type Body = {
  receipt_id?: string;
  path?: string; // backwards-compat
  expires_in?: number;
};

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
  if (!body.receipt_id && !body.path) {
    return NextResponse.json(
      { error: "Missing receipt_id (preferred) or path." },
      { status: 400 }
    );
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
  const bucket = "receipts";
  const expiresIn = Math.min(Math.max(body.expires_in ?? 600, 60), 3600);

  let storagePath: string | null = null;

  if (body.receipt_id) {
    const { data: receipt, error: rErr } = await supabase
      .from("receipts")
      .select("id, user_id, storage_path")
      .eq("id", body.receipt_id)
      .single();

    if (rErr || !receipt) {
      return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
    }
    if (receipt.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    storagePath = receipt.storage_path;
  } else if (body.path) {
    const { data: receipt, error: rErr } = await supabase
      .from("receipts")
      .select("id, user_id, storage_path")
      .eq("storage_path", body.path)
      .single();

    if (rErr || !receipt) {
      return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
    }
    if (receipt.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    storagePath = receipt.storage_path;
  }

  if (!storagePath) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create signed URL." },
      { status: 500 }
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl }, { status: 200 });
}
