import { NextResponse } from "next/server";
import { supabaseServiceClient } from "@/lib/supabase/service";

type Body = { path: string; expires_in?: number };

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Body>;
  if (!body.path) {
    return NextResponse.json({ error: "Missing path." }, { status: 400 });
  }

  const supabase = supabaseServiceClient();
  const bucket = "receipts";
  const expiresIn = Math.min(Math.max(body.expires_in ?? 600, 60), 3600); // 1–60 minutes -> clamp

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(body.path, expiresIn);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create signed URL." },
      { status: 500 }
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl }, { status: 200 });
}
