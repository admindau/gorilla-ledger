import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/session";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <h1 className="text-3xl">
        Welcome to Gorilla Ledger 🦍
      </h1>
    </div>
  );
}
