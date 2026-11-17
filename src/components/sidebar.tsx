"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  Building2,
  FileText,
  Handshake,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ModuleKey } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown only when this module is enabled for the user (admins see all). */
  module?: ModuleKey;
  /** Shown when ANY of these modules is enabled (admins see all). */
  anyModule?: ModuleKey[];
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/developers", label: "Developers", icon: Building2, module: "developers" },
  { href: "/letters", label: "Letters", icon: FileText, module: "letters" },
  { href: "/finance", label: "Finance", icon: Receipt, module: "finance" },
  { href: "/agents", label: "Agents & RERA", icon: UserCheck, module: "agents" },
  { href: "/deals", label: "Clients & Deals", icon: Handshake, module: "deals" },
  // Own issued letters/invoices (admins & accountants with scope "all" see everyone's).
  { href: "/documents", label: "Documents", icon: Archive, anyModule: ["letters", "finance", "deals"] },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export function Sidebar({
  role,
  name,
  configured,
  modules,
}: {
  role: "admin" | "accountant" | "agent";
  name: string;
  configured: boolean;
  modules: Record<ModuleKey, boolean>;
}) {
  const pathname = usePathname();

  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="no-print glass-dark z-20 flex w-full shrink-0 flex-col border-b text-white md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="px-5 pb-4 pt-6">
        {/* Light variant of the logo: transparent background, white wordmark + ice-blue pin */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/citiway-logo-light.png" alt="Citiway Real Estate" className="h-9 w-auto drop-shadow-[0_2px_12px_rgba(122,163,216,0.35)]" />
        <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
          Back-Office · Dubai
        </div>
      </div>
      <nav className="flex flex-row gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-y-auto">
        {NAV.filter((n) => {
          if (n.adminOnly) return role === "admin";
          if (role === "admin") return true;
          if (n.module) return modules[n.module];
          if (n.anyModule) return n.anyModule.some((m) => modules[m]);
          return true;
        }).map((n) => {
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-gradient-to-b before:from-cyan-300 before:to-indigo-400 before:shadow-[0_0_12px_rgba(103,232,249,0.8)] before:transition-transform before:duration-300 ${
                active
                  ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/10 before:scale-y-100"
                  : "text-white/65 before:scale-y-0 hover:translate-x-0.5 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icon
                className={`h-4 w-4 transition-colors duration-200 ${
                  active ? "text-cyan-300 drop-shadow-[0_0_6px_rgba(103,232,249,0.7)]" : "text-white/55 group-hover:text-cyan-200"
                }`}
              />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mx-3 mb-4 hidden rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs md:block">
        <div className="truncate font-semibold">{name}</div>
        <div className="mb-2.5 capitalize text-white/55">{configured ? role : "setup required"}</div>
        {configured && (
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-white/65 transition-colors duration-200 hover:text-cyan-200"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        )}
      </div>
    </aside>
  );
}
