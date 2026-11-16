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
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: ("admin" | "accountant" | "agent")[];
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "accountant", "agent"] },
  { href: "/developers", label: "Developers", icon: Building2, roles: ["admin", "accountant", "agent"] },
  { href: "/letters", label: "Letters", icon: FileText, roles: ["admin", "accountant", "agent"] },
  { href: "/finance", label: "Finance", icon: Receipt, roles: ["admin", "accountant"] },
  { href: "/agents", label: "Agents & RERA", icon: UserCheck, roles: ["admin", "accountant", "agent"] },
  { href: "/deals", label: "Clients & Deals", icon: Handshake, roles: ["admin", "accountant", "agent"] },
];

export function Sidebar({
  role,
  name,
  configured,
}: {
  role: "admin" | "accountant" | "agent";
  name: string;
  configured: boolean;
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
        {NAV.filter((n) => n.roles.includes(role)).map((n) => {
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
