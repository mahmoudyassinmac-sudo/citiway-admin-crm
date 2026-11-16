"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { Field, Modal, inputCls } from "@/components/ui/modal";
import { presetFor, summarizePermissions, type Permissions, type Role } from "@/lib/permissions";
import {
  createDashboardUser,
  deleteDashboardUser,
  resetUserPassword,
  updateUserPermissions,
} from "@/app/(app)/settings/actions";
import { PermissionsEditor, RoleBadge, RolePicker } from "./permissions-editor";

export interface UserRow {
  id: string;
  fullName: string | null;
  email: string | null;
  role: Role;
  permissions: Permissions; // effective
  lastSignIn: string | null;
  agentId: string | null;
}
export interface AgentOption {
  id: string;
  full_name: string;
  rera_brn: string | null;
  user_id: string | null;
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const a = new Uint32Array(14);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join("");
}

/* ------------------------------ Add user ------------------------------ */
function AddUserModal({ agents, onClose, onDone }: { agents: AgentOption[]; onClose: () => void; onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [perms, setPerms] = useState<Permissions>(presetFor("agent"));
  const [agentChoice, setAgentChoice] = useState(""); // "" | "__new__" | agent id
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await createDashboardUser({
      fullName, email, password, role, permissions: perms,
      agentId: agentChoice && agentChoice !== "__new__" ? agentChoice : null,
      createAgentRow: agentChoice === "__new__",
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onDone();
  }

  return (
    <Modal title="Add new user" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Full name"><input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus /></Field>
        <Field label="Email"><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></Field>
        <Field label="Password" hint="At least 8 characters. Share it securely; the user can't see it again.">
          <div className="flex gap-2">
            <input type="text" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <button type="button" onClick={() => setPassword(randomPassword())} className="whitespace-nowrap rounded-lg px-3 text-xs font-semibold text-navy ring-1 ring-brand-line hover:bg-brand-soft">Generate</button>
          </div>
        </Field>
        <RolePicker role={role} onChange={(r) => { setRole(r); setPerms(presetFor(r)); }} />
        <Field label="Link to agent record (optional)" hint="Links this login to an agent so their own deals, name and BRN follow them.">
          <select className={inputCls} value={agentChoice} onChange={(e) => setAgentChoice(e.target.value)}>
            <option value="">— none —</option>
            <option value="__new__">+ Create a new agent record for this user</option>
            {agents.filter((a) => !a.user_id).map((a) => (
              <option key={a.id} value={a.id}>{a.full_name}{a.rera_brn ? ` · BRN ${a.rera_brn}` : ""}</option>
            ))}
          </select>
        </Field>
        <PermissionsEditor role={role} value={perms} onChange={setPerms} />
        {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button disabled={busy} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">{busy ? "Creating…" : "Create user"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------ Edit user ------------------------------ */
function EditUserModal({ user, agents, isSelf, onClose, onDone }: { user: UserRow; agents: AgentOption[]; isSelf: boolean; onClose: () => void; onDone: () => void }) {
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [role, setRole] = useState<Role>(user.role);
  const [perms, setPerms] = useState<Permissions>(user.permissions);
  const [agentId, setAgentId] = useState(user.agentId ?? "");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo(""); setBusy(true);
    const res = await updateUserPermissions({ userId: user.id, fullName, role, permissions: perms, agentId: agentId || null });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onDone();
  }
  async function reset() {
    setError(""); setInfo("");
    const res = await resetUserPassword({ userId: user.id, password: newPw });
    if (!res.ok) return setError(res.error);
    setNewPw(""); setInfo("Password updated. Share it securely with the user.");
  }
  async function remove() {
    if (!confirm(`Permanently delete ${user.fullName ?? user.email}? They will no longer be able to sign in.`)) return;
    const res = await deleteDashboardUser({ userId: user.id });
    if (!res.ok) return setError(res.error);
    onDone();
  }

  return (
    <Modal title={`Edit — ${user.fullName ?? user.email ?? "user"}`} onClose={onClose}>
      <form onSubmit={save}>
        <p className="mb-3 text-xs text-slate-500">{user.email}</p>
        <Field label="Full name"><input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
        <RolePicker role={role} onChange={(r) => { setRole(r); setPerms(presetFor(r)); }} />
        {isSelf && role !== "admin" && <p className="mb-3 text-xs text-red-600">You can&apos;t remove your own admin role.</p>}
        <Field label="Linked agent record">
          <select className={inputCls} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">— none —</option>
            {agents.filter((a) => !a.user_id || a.user_id === user.id).map((a) => (
              <option key={a.id} value={a.id}>{a.full_name}{a.rera_brn ? ` · BRN ${a.rera_brn}` : ""}</option>
            ))}
          </select>
        </Field>
        <PermissionsEditor role={role} value={perms} onChange={setPerms} />

        <div className="mb-4 rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-navy"><KeyRound className="h-3.5 w-3.5" /> Reset password</div>
          <div className="flex gap-2">
            <input type="text" className={inputCls} placeholder="New password (min 8)" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
            <button type="button" onClick={() => setNewPw(randomPassword())} className="whitespace-nowrap rounded-lg px-3 text-xs font-semibold text-navy ring-1 ring-brand-line hover:bg-brand-soft">Generate</button>
            <button type="button" onClick={reset} disabled={newPw.length < 8} className="whitespace-nowrap rounded-lg bg-navy px-3 text-xs font-semibold text-white disabled:opacity-40">Set</button>
          </div>
        </div>

        {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
        {info && <p className="mb-3 text-sm text-emerald-700">{info}</p>}
        <div className="flex items-center justify-between gap-2">
          {!isSelf ? (
            <button type="button" onClick={remove} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete user</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
            <button disabled={busy} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------ List ------------------------------ */
export function UsersManager({ users, agents, currentUserId }: { users: UserRow[]; agents: AgentOption[]; currentUserId: string | null }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const done = () => { setAdding(false); setEditing(null); router.refresh(); };
  const agentName = (id: string | null) => agents.find((a) => a.id === id)?.full_name ?? "—";

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{users.length} user(s). Changes apply on the user&apos;s next page load.</p>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"><Plus className="h-4 w-4" /> Add new user</button>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Linked agent</th>
              <th className="px-4 py-3">Permissions</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">No users yet.</td></tr>}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 align-top last:border-0">
                <td className="px-4 py-3">
                  <div className="font-semibold text-navy">{u.fullName ?? "—"}{u.id === currentUserId && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-3 text-slate-600">{agentName(u.agentId)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5 text-xs text-slate-600">
                    {summarizePermissions(u.role, u.permissions).map((line) => <span key={line}>{line}</span>)}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(u)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-navy ring-1 ring-brand-line hover:bg-brand-soft"><Pencil className="h-3.5 w-3.5" /> Edit permissions</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && <AddUserModal agents={agents} onClose={() => setAdding(false)} onDone={done} />}
      {editing && <EditUserModal user={editing} agents={agents} isSelf={editing.id === currentUserId} onClose={() => setEditing(null)} onDone={done} />}
    </>
  );
}
