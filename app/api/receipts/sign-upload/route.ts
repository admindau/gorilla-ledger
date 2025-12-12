import { NextResponse } from "next/server";
import { supabaseServiceClient } from "@/lib/supabase/service";

type Body = {
  user_id: string;
  transaction_id: string;
  receipt_id: string;
  ext: string; // e.g. "pdf", "jpg"
};

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Body>;

  if (!body.user_id || !body.transaction_id || !body.receipt_id || !body.ext) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const bucket = "receipts";
  const cleanExt = body.ext.replace(".", "").toLowerCase();
  const path = `${body.user_id}/${body.transaction_id}/${body.receipt_id}.${cleanExt}`;

  const supabase = supabaseServiceClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create signed upload URL." },
      { status: 500 }
    );
  }

  return NextResponse.json({ bucket, path, token: data.token }, { status: 200 });
}
