import { Sidebar } from "@/components/sidebar";
import { getSession } from "@/lib/auth";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        role={session.role}
        name={session.fullName ?? session.email ?? "Guest"}
        configured={session.configured}
        modules={session.permissions.modules}
      />
      <div className="min-w-0 flex-1">
        {!session.configured && (
          <div className="no-print flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code>,
              fill in your project keys and run <code>supabase/schema.sql</code>. Data features are
              disabled until then.
            </span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
