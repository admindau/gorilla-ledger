import { supabaseServiceClient } from "@/lib/supabase/service";

export async function getLedgerAccessForOwner(
  userId: string,
  ownerUserId: string,
) {
  const service = supabaseServiceClient();
  const { data: ledger, error: ledgerError } = await service
    .from("ledgers")
    .select("id")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (ledgerError || !ledger) return null;

  const { data: member, error: memberError } = await service
    .from("ledger_members")
    .select("role")
    .eq("ledger_id", ledger.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError || !member) return null;
  return { ledgerId: ledger.id as string, role: member.role as "owner" | "editor" | "viewer" };
}
