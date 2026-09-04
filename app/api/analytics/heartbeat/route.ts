import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { applyPrivateNoStore } from "@/lib/http/privateCache";
import { hasTrustedMutationOrigin } from "@/lib/http/sameOrigin";

function response(body: object, status = 200) {
  const result = NextResponse.json(body, { status });
  applyPrivateNoStore(result.headers);
  return result;
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return response({ error: "Request origin could not be verified." }, 403);
  const user = await getUser();
  if (!user) return response({ error: "Unauthorized" }, 401);

  const { error } = await getSupabaseAdminClient().rpc("record_user_activity", {
    p_user_id: user.id,
  });

  if (error) {
    console.error("[analytics-heartbeat] Unable to record activity.", {
      userId: user.id,
      code: error.code,
    });
    return response({ error: "Activity tracking is temporarily unavailable." }, 503);
  }

  return response({ ok: true });
}
