import { DevelopersManager } from "@/components/developers/developers-manager";
import { getSession } from "@/lib/auth";
import type { Developer } from "@/lib/developers";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Developers — Citiway CRM" };

export default async function DevelopersPage() {
  const session = await getSession();
  let developers: Developer[] = [];
  let loadError = "";

  if (session.configured) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("developers")
      .select("*")
      .order("end_date", { ascending: true });
    if (error) loadError = error.message;
    developers = (data ?? []) as Developer[];
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-head text-2xl font-bold text-navy">Developers &amp; Agreements</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        Track broker agreements and NOCs with Dubai developers. Agreements within 30 days of expiry
        trigger a daily alert email until renewed.
      </p>
      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load developers: {loadError}. Have you run <code>supabase/schema.sql</code>?
        </div>
      )}
      <DevelopersManager
        developers={developers}
        canEdit={session.role === "admin"}
        enabled={session.configured}
      />
    </div>
  );
}
