import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin/access";
import { applyPrivateNoStore } from "@/lib/http/privateCache";

function response(body: object, status = 200) {
  const result = NextResponse.json(body, { status });
  applyPrivateNoStore(result.headers);
  return result;
}

export async function GET() {
  const user = await getUser();
  if (!user) return response({ error: "Unauthorized" }, 401);
  if (!isPlatformAdmin(user.email)) return response({ error: "Forbidden" }, 403);

  const { data, error } = await getSupabaseAdminClient().rpc("get_platform_usage_metrics");
  if (error) {
    console.error("[admin-analytics] Unable to load metrics.", { code: error.code });
    return response({ error: "Usage metrics are temporarily unavailable." }, 503);
  }

  return response(data && typeof data === "object" ? data : {});
}
