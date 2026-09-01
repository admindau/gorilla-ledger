import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServiceClient } from "@/lib/supabase/service";
import { getLedgerAccessForOwner } from "@/lib/family/access";

type Body = {
  transaction_id: string;
  receipt_id: string;
  ext: string; // e.g. "pdf", "jpg"
};

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const RECEIPT_EXTENSIONS: Record<string, readonly string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/heic": ["heic"],
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
    .select("id, user_id, transaction_id, original_name, mime_type, size_bytes")
    .eq("id", body.receipt_id)
    .single();

  if (rErr || !receipt) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  const access = await getLedgerAccessForOwner(userId, receipt.user_id);
  if (!access) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (access.role === "viewer") {
    return NextResponse.json({ error: "View-only members cannot add receipts." }, { status: 403 });
  }

  if (receipt.transaction_id !== body.transaction_id) {
    return NextResponse.json(
      { error: "Receipt/transaction mismatch." },
      { status: 400 }
    );
  }

  const allowedExtensions = RECEIPT_EXTENSIONS[receipt.mime_type];
  if (!allowedExtensions || receipt.size_bytes <= 0 || receipt.size_bytes > MAX_RECEIPT_BYTES) {
    return NextResponse.json(
      { error: "Receipt must be a PDF, JPEG, PNG, WebP, or HEIC file no larger than 5 MB." },
      { status: 415 }
    );
  }

  const originalExtension = cleanExt(receipt.original_name.split(".").pop() ?? "");
  if (!allowedExtensions.includes(originalExtension) || !allowedExtensions.includes(ext)) {
    return NextResponse.json({ error: "Receipt extension does not match its declared file type." }, { status: 415 });
  }

  const path = `${access.ledgerId}/${body.transaction_id}/${body.receipt_id}.${originalExtension}`;

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
