"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Trash2, Upload } from "lucide-react";
import { removeBrandImage, uploadBrandImage } from "@/app/(app)/settings/brand-actions";

type Kind = "stamp" | "signature";

function Slot({ kind, custom, version }: { kind: Kind; custom: boolean; version: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const exists = kind === "stamp" || custom;

  async function upload(file: File) {
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    const res = await uploadBrandImage(fd);
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
    if (res.ok) router.refresh();
  }
  async function remove() {
    if (!window.confirm(kind === "stamp" ? "Go back to the built-in Citiway stamp?" : "Remove the signature image?")) return;
    setBusy(true); setMsg(null);
    const res = await removeBrandImage(kind);
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
    if (res.ok) router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 p-4">
      <div className="mb-1 text-sm font-semibold text-navy">{kind === "stamp" ? "Company stamp" : "Authorised signature"}</div>
      <p className="mb-3 text-xs text-slate-500">
        {kind === "stamp"
          ? custom ? "Your uploaded stamp." : "Using the built-in Citiway stamp & signature."
          : custom ? "Printed next to the stamp." : "Optional — upload one to print it next to the stamp."}
      </p>
      <div className="mb-3 flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
        {exists ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/brand/${kind}?v=${version}`} alt="" className="max-h-24 max-w-[90%] object-contain" />
        ) : (
          <span className="text-xs text-slate-400">No image</span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) upload(f);
        }}
      />
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn-primary flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
          <Upload className="h-3.5 w-3.5" /> {busy ? "Working…" : custom ? "Replace" : "Upload"}
        </button>
        {custom && (
          <button type="button" disabled={busy} onClick={remove} className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">
            <Trash2 className="h-3.5 w-3.5" /> {kind === "stamp" ? "Use built-in" : "Remove"}
          </button>
        )}
      </div>
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}

export function BrandAssets({ stampCustom, signatureCustom, version }: { stampCustom: boolean; signatureCustom: boolean; version: string }) {
  return (
    <div className="mt-6 max-w-2xl rounded-2xl glass p-6">
      <div className="mb-1 flex items-center gap-2 text-base font-semibold text-navy">
        <ShieldCheck className="h-4 w-4 text-amber-600" /> Stamp &amp; signature
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Only you (Super Admin) can see these images or put them on documents. Other users send their documents to your
        Approvals queue. Use a PNG with a transparent background for the best result.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Slot kind="stamp" custom={stampCustom} version={version} />
        <Slot kind="signature" custom={signatureCustom} version={version} />
      </div>
    </div>
  );
}
