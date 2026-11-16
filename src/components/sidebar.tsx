"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/developers", label: "Developers", icon: Building2, module: "developers" },
  { href: "/letters", label: "Letters", icon: FileText, module: "letters" },
  { href: "/finance", label: "Finance", icon: Receipt, module: "finance" },
  { href: "/agents", label: "Agents & RERA", icon: UserCheck, module: "agents" },
  { href: "/deals", label: "Clients & Deals", icon: Handshake, module: "deals" },
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
    <aside className="no-print flex w-full shrink-0 flex-col bg-navy text-white md:min-h-screen md:w-60">
      <div className="flex items-center gap-3 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/citiway-logo.png" alt="Citiway" className="h-8 w-auto rounded bg-white p-1" />
        <div className="font-head text-sm font-bold leading-tight tracking-wide">
          Back-Office
          <div className="text-[10px] font-medium text-brand">Dubai · UAE</div>
        </div>
      </div>
      <nav className="flex flex-row gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible">
        {NAV.filter((n) =>
          n.adminOnly ? role === "admin" : n.module ? role === "admin" || modules[n.module] : true,
        ).map((n) => {
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden border-t border-white/10 px-5 py-4 text-xs md:block">
        <div className="truncate font-semibold">{name}</div>
        <div className="mb-3 capitalize text-white/60">{configured ? role : "setup required"}</div>
        {configured && (
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-white/70 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        )}
      </div>
    </aside>
  );
}
