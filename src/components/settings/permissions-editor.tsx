"use client";

import {
  DOC_LABELS,
  DOC_TYPES,
  MODULE_KEYS,
  MODULE_LABELS,
  ROLES,
  type Permissions,
  type Role,
} from "@/lib/permissions";

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", accountant: "Accountant", agent: "Agent" };

export function RoleBadge({ role }: { role: Role }) {
  const cls =
    role === "admin" ? "bg-navy text-white" : role === "accountant" ? "bg-brand-soft text-navy" : "bg-emerald-50 text-emerald-700";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{ROLE_LABEL[role]}</span>;
}

function Check({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" className="h-4 w-4" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

const sectionCls = "mb-4 rounded-xl border border-slate-200 p-3";
const titleCls = "mb-2 text-[11px] font-bold uppercase tracking-wider text-navy";

export function RolePicker({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-xs font-semibold text-navy">Role preset</span>
      <select
        value={role}
        onChange={(e) => onChange(e.target.value as Role)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
        ))}
      </select>
      <span className="mt-1 block text-[11px] text-slate-500">
        Changing the role resets the checkboxes below to that role&apos;s defaults; you can then fine-tune them.
      </span>
    </label>
  );
}

export function PermissionsEditor({ role, value, onChange }: { role: Role; value: Permissions; onChange: (p: Permissions) => void }) {
  const locked = role === "admin";
  return (
    <div>
      {locked && (
        <p className="mb-3 rounded-lg bg-brand-soft px-3 py-2 text-xs text-navy">
          Admins always have full access to every module, document type and record.
        </p>
      )}
      <fieldset className={sectionCls} disabled={locked}>
        <legend className={titleCls}>Sidebar modules</legend>
        <div className="grid grid-cols-2 gap-2">
          {MODULE_KEYS.map((k) => (
            <Check key={k} label={MODULE_LABELS[k]} checked={value.modules[k]} disabled={locked}
              onChange={(v) => onChange({ ...value, modules: { ...value.modules, [k]: v } })} />
          ))}
        </div>
      </fieldset>
      <fieldset className={sectionCls} disabled={locked}>
        <legend className={titleCls}>Allowed finance document types</legend>
        <div className="grid grid-cols-2 gap-2">
          {DOC_TYPES.map((k) => (
            <Check key={k} label={DOC_LABELS[k]} checked={value.finance_docs[k]} disabled={locked}
              onChange={(v) => onChange({ ...value, finance_docs: { ...value.finance_docs, [k]: v } })} />
          ))}
        </div>
        {!value.modules.finance && !locked && (
          <p className="mt-2 text-[11px] text-amber-700">Finance & Contracts module is off, so these have no effect.</p>
        )}
      </fieldset>
      <fieldset className={sectionCls} disabled={locked}>
        <legend className={titleCls}>Actions &amp; visibility</legend>
        <Check label="Can create / issue documents" checked={value.can_create_finance} disabled={locked}
          onChange={(v) => onChange({ ...value, can_create_finance: v })} />
        <div className="mt-3 space-y-1.5 text-sm">
          {(["own", "all"] as const).map((s) => (
            <label key={s} className={`flex items-center gap-2 ${locked ? "opacity-50" : ""}`}>
              <input type="radio" className="h-4 w-4" name="scope" checked={value.scope === s} disabled={locked}
                onChange={() => onChange({ ...value, scope: s })} />
              {s === "own" ? "Own records only (created by them / their linked agent)" : "All company records"}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
