"use client";

import { createContext, useContext, useState } from "react";
import { BadgeCheck, Send, Stamp } from "lucide-react";
import type { SignoffMode } from "@/lib/signoff";

export interface SignoffConfig {
  /** Only the Super Admin can put the company stamp & signature on a document. */
  isSuperAdmin: boolean;
  /** Images printed in a stamp slot, in order ("signature" is optional). */
  stampKinds: ("signature" | "stamp")[];
  /** Does this tool have a company stamp area at all? */
  stampable: boolean;
}

interface Ctx extends SignoffConfig {
  mode: SignoffMode;
  setMode: (m: SignoffMode) => void;
}

const SignoffContext = createContext<Ctx>({
  isSuperAdmin: false,
  stampKinds: ["stamp"],
  stampable: false,
  mode: "none",
  setMode: () => {},
});

export const useSignoff = () => useContext(SignoffContext);

export function SignoffProvider({ config, children }: { config: SignoffConfig; children: React.ReactNode }) {
  // Agents default to asking for the stamp; the Super Admin turns it on deliberately per document.
  const [mode, setMode] = useState<SignoffMode>(config.stampable && !config.isSuperAdmin ? "request" : "none");
  return <SignoffContext.Provider value={{ ...config, mode, setMode }}>{children}</SignoffContext.Provider>;
}

/**
 * The company stamp area of a document. Always rendered (so the archived PDF records where the
 * stamp goes); it only shows the images on the Super Admin's screen when they chose "Stamp now".
 * The server applies the same layout when the Super Admin approves a pending document.
 */
export function StampSlot({ align = "center", style }: { align?: "left" | "center" | "right"; style?: React.CSSProperties }) {
  const { isSuperAdmin, mode, stampKinds, stampable } = useSignoff();
  const show = stampable && isSuperAdmin && mode === "stamp";
  return (
    <div
      data-stamp-anchor=""
      data-stamp-align={align}
      style={{
        position: "absolute",
        display: "grid",
        gridTemplateColumns: `repeat(${stampKinds.length}, minmax(0, 1fr))`,
        gridTemplateRows: "100%",
        pointerEvents: "none",
        zIndex: 2,
        ...style,
      }}
    >
      {show &&
        stampKinds.map((k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={k}
            src={`/api/brand/${k}`}
            alt={k === "stamp" ? "Company stamp" : "Authorised signature"}
            style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: `${align} center` }}
          />
        ))}
    </div>
  );
}

/** Stamp choice shown above tools that have a company stamp area. */
export function SignoffChoice({ compact = false }: { compact?: boolean }) {
  const { isSuperAdmin, mode, setMode, stampable } = useSignoff();
  if (!stampable) return null;
  const btn = (active: boolean) =>
    `flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[12px] font-semibold transition ${
      active ? "bg-[#1E3553] text-white shadow" : "text-slate-600 hover:bg-white"
    }`;
  return (
    <div className={compact ? "space-y-2" : "no-print mx-auto mb-4 max-w-3xl rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm"}>
      {!compact && <div className="mb-2 text-[12px] font-semibold text-[#1E3553]">Company stamp &amp; signature</div>}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        <button type="button" className={btn(mode === "none")} onClick={() => setMode("none")}>
          No stamp
        </button>
        {isSuperAdmin ? (
          <button type="button" className={btn(mode === "stamp")} onClick={() => setMode("stamp")}>
            <Stamp className="h-3.5 w-3.5" /> Stamp &amp; sign now
          </button>
        ) : (
          <button type="button" className={btn(mode === "request")} onClick={() => setMode("request")}>
            <Send className="h-3.5 w-3.5" /> Request from Super Admin
          </button>
        )}
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-slate-500">
        <BadgeCheck className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-600" />
        {mode === "stamp"
          ? "The stamp & signature are printed and the archived PDF is marked approved."
          : mode === "request"
            ? "After you issue it, the PDF is archived and waits in the Super Admin's approval queue. The stamped copy appears in Documents once approved."
            : "Every issued document is archived as a PDF in Documents."}
      </p>
    </div>
  );
}
