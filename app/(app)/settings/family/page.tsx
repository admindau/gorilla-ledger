"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

type LedgerSummary = { id: string; name: string; role: "owner" | "editor" };
type Member = { user_id: string; email: string; role: "owner" | "editor"; joined_at: string; is_current_user: boolean };
type Invitation = { id: string; email: string; role: "editor"; expires_at: string; created_at: string };
type Overview = { ledger: LedgerSummary; available_ledgers: LedgerSummary[]; members: Member[]; invitations: Invitation[] };

function apiError(value: unknown, fallback: string) {
  if (typeof value === "object" && value && "error" in value && typeof value.error === "string") return value.error;
  return fallback;
}

export default function FamilySettingsPage() {
  const router = useRouter();
  const inviteToken = useSearchParams().get("invite");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadOverview = useCallback(async () => {
    const response = await fetch("/api/family/overview", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiError(body, "Unable to load family access."));
    setOverview(body as Overview);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setLoading(true); setError("");
      try {
        if (inviteToken) {
          const accepted = await fetch("/api/family/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: inviteToken }) });
          const body = await accepted.json().catch(() => ({}));
          if (!accepted.ok) {
            if (!cancelled) setError(apiError(body, "Unable to accept this invitation."));
          } else if (!cancelled) {
            setSuccess("You’ve joined the household ledger.");
          }
          router.replace("/settings/family");
        }
        await loadOverview();
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load family access.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void boot();
    return () => { cancelled = true; };
  }, [inviteToken, loadOverview, router]);

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/family/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body, "Unable to send the invitation."));
      setEmail(""); setSuccess(body.message ?? "Invitation sent."); await loadOverview();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send the invitation."); }
    finally { setBusy(false); }
  }

  async function changeLedger(ledgerId: string) {
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/family/active-ledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ledger_id: ledgerId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body, "Unable to change ledgers."));
      await loadOverview(); router.refresh(); setSuccess("Active ledger changed.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to change ledgers."); }
    finally { setBusy(false); }
  }

  async function revokeInvitation(invitation: Invitation) {
    if (!window.confirm(`Revoke the invitation for ${invitation.email}?`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/family/invitations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitation_id: invitation.id }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body, "Unable to revoke the invitation."));
      setSuccess("Invitation revoked."); await loadOverview();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to revoke the invitation."); }
    finally { setBusy(false); }
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.email} from this ledger? Access will end immediately.`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/family/members", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: member.user_id }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body, "Unable to remove this family member."));
      setSuccess("Family member removed."); await loadOverview();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to remove this family member."); }
    finally { setBusy(false); }
  }

  const isOwner = overview?.ledger.role === "owner";
  return <PageShell className="gl-page-stack" size="lg">
    <PageHeader eyebrow="Household collaboration" title="Family & access" description="Invite someone you trust to help manage the same ledger using their own secure account." />
    {error ? <p className="gl-auth-alert gl-auth-alert-error" role="alert">{error}</p> : null}
    {success ? <p className="gl-auth-alert gl-auth-alert-success" role="status">{success}</p> : null}
    {loading || !overview ? <Card><CardBody><p className="text-sm text-gray-400">Loading household access…</p></CardBody></Card> : <>
      {overview.available_ledgers.length > 1 ? <Card><CardHeader><div><p className="gl-page-eyebrow">Active workspace</p><h2 className="text-lg font-semibold text-white">Choose a ledger</h2></div></CardHeader><CardBody><Select label="Ledger" value={overview.ledger.id} disabled={busy} onChange={(event) => void changeLedger(event.target.value)}>{overview.available_ledgers.map((ledger) => <option key={ledger.id} value={ledger.id}>{ledger.name} · {ledger.role}</option>)}</Select></CardBody></Card> : null}
      <Card variant="premium"><CardHeader><div><p className="gl-page-eyebrow">Current household</p><h2 className="text-xl font-semibold text-white">{overview.ledger.name}</h2></div><Badge variant={isOwner ? "success" : "neutral"}>{isOwner ? "Owner" : "Editor"}</Badge></CardHeader><CardBody className="space-y-4">
        <p className="text-sm leading-6 text-gray-300">Editors can view and manage wallets, transactions, budgets, recurring entries, receipts, and exports. Only the owner can invite or remove people.</p>
        <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4"><p className="text-sm font-medium text-emerald-100">Separate accounts, shared ledger</p><p className="mt-1 text-xs leading-5 text-gray-400">Every family member keeps their own passwordless login and MFA settings. Access can be removed without changing anyone else’s account.</p></div>
        <div className="divide-y divide-white/10 rounded-xl border border-white/10">{overview.members.map((member) => <div key={member.user_id} className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{member.email}</p><p className="mt-1 text-xs text-gray-500">{member.role === "owner" ? "Ledger owner" : "Can view and edit"}{member.is_current_user ? " · You" : ""}</p></div><div className="flex items-center gap-2"><Badge variant={member.role === "owner" ? "success" : "neutral"}>{member.role === "owner" ? "Owner" : "Editor"}</Badge>{isOwner && member.role !== "owner" ? <Button variant="danger" size="sm" disabled={busy} onClick={() => void removeMember(member)}>Remove</Button> : null}</div></div>)}</div>
      </CardBody></Card>
      {isOwner ? <Card><CardHeader><div><p className="gl-page-eyebrow">Add someone</p><h2 className="text-lg font-semibold text-white">Invite a family member</h2></div></CardHeader><CardBody className="space-y-5">
        <form className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={inviteMember}><Input label="Email address" type="email" placeholder="family@example.com" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send invitation"}</Button></form>
        <p className="text-xs leading-5 text-gray-500">The invitation expires after seven days and can only be accepted by this email address.</p>
        {overview.invitations.length ? <div><h3 className="mb-2 text-sm font-semibold text-white">Pending invitations</h3><div className="divide-y divide-white/10 rounded-xl border border-white/10">{overview.invitations.map((invitation) => <div key={invitation.id} className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="truncate text-sm text-white">{invitation.email}</p><p className="mt-1 text-xs text-gray-500">Expires {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(invitation.expires_at))}</p></div><Button variant="ghost" size="sm" disabled={busy} onClick={() => void revokeInvitation(invitation)}>Revoke</Button></div>)}</div></div> : null}
      </CardBody></Card> : <p className="text-center text-xs text-gray-600">Your access is managed by the ledger owner.</p>}
    </>}
  </PageShell>;
}
