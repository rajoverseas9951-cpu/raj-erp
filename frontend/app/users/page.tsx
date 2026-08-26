"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { authenticatedRequest } from "@/lib/api-client";

type Role = {
  id: string;
  name: string;
  description?: string | null;
  permissions?: Array<{ id?: string; name?: string }>;
};

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  role?: string | null;
  roles?: Role[];
  created_at?: string | null;
};

type EditorState = {
  id?: string;
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  is_active: boolean;
  role_ids: string[];
};

const emptyEditor: EditorState = {
  name: "",
  email: "",
  password: "",
  password_confirmation: "",
  is_active: true,
  role_ids: [],
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [userRows, roleRows] = await Promise.all([
        authenticatedRequest<User[]>("/users?per_page=100"),
        authenticatedRequest<Role[]>("/roles"),
      ]);
      setUsers(userRows ?? []);
      setRoles(roleRows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Team data could not load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      `${user.name} ${user.email} ${user.phone ?? ""} ${user.role ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [users, search]);

  const activeCount = users.filter((user) => user.is_active).length;

  function editUser(user: User) {
    setEditor({
      id: user.id,
      name: user.name,
      email: user.email,
      password: "",
      password_confirmation: "",
      is_active: user.is_active,
      role_ids: (user.roles ?? [])
        .map((role) => role.id)
        .filter(Boolean),
    });
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        name: editor.name.trim(),
        email: editor.email.trim().toLowerCase(),
        is_active: editor.is_active,
        role_ids: editor.role_ids,
      };
      if (editor.password) {
        payload.password = editor.password;
        payload.password_confirmation = editor.password_confirmation;
      }
      await authenticatedRequest<User>(editor.id ? `/users/${editor.id}` : "/users", {
        method: editor.id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setEditor(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "User could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: User) {
    setError("");
    try {
      await authenticatedRequest<User>(`/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          is_active: !user.is_active,
          role_ids: (user.roles ?? []).map((role) => role.id),
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "User status could not be changed.");
    }
  }

  async function removeUser(user: User) {
    if (!window.confirm(`Delete ${user.name}? This should only be used for users who must no longer access ERP.`)) return;
    setError("");
    try {
      await authenticatedRequest(`/users/${user.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "User could not be deleted.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] p-4 text-slate-900 md:p-6 dark:bg-[#070b14] dark:text-white">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <section className="rounded-[28px] bg-[#0b1f3a] p-6 text-white shadow-xl md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-300">Administration</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.03em] md:text-4xl">Team & Roles</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-300">ERP login users create karo, role assign karo, access deactivate karo aur team control ek jagah se manage karo.</p>
            </div>
            <button onClick={() => setEditor({ ...emptyEditor })} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#0b1f3a]">+ Add team member</button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Total users" value={String(users.length)} />
            <Stat label="Active users" value={String(activeCount)} />
            <Stat label="Available roles" value={String(roles.length)} />
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[.04]">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
              <div>
                <h2 className="text-lg font-black">Team members</h2>
                <p className="mt-1 text-xs text-slate-500">Only users in your current ERP organization are shown.</p>
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or role…" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-blue-400 sm:w-80 dark:border-white/10 dark:bg-white/[.05]" />
            </div>
            {loading ? <div className="p-10 text-sm text-slate-500">Loading team…</div> : filtered.length ? (
              <div className="divide-y divide-slate-100 dark:divide-white/10">
                {filtered.map((user) => (
                  <div key={user.id} className="grid gap-3 p-4 md:grid-cols-[1.3fr_.9fr_.55fr_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-sm font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{initials(user.name)}</div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">{user.name}</p>
                          <p className="truncate text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Role</p>
                      <p className="mt-1 text-xs font-bold">{(user.roles ?? []).map((role) => role.name).join(", ") || user.role || "No role assigned"}</p>
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black ${user.is_active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>{user.is_active ? "ACTIVE" : "INACTIVE"}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <button onClick={() => editUser(user)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-black dark:border-white/10">Edit</button>
                      <button onClick={() => void toggleActive(user)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-black dark:border-white/10">{user.is_active ? "Deactivate" : "Activate"}</button>
                      <button onClick={() => void removeUser(user)} className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-black text-rose-600">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="p-10 text-center text-sm text-slate-500">No team members found.</div>}
          </div>

          <aside className="self-start rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[.04]">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Role access</p>
            <h2 className="mt-2 text-xl font-black">Available roles</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">Roles define what a team member can view or change. Assign roles while adding or editing a user.</p>
            <div className="mt-4 space-y-2">
              {roles.length ? roles.map((role) => (
                <div key={role.id} className="rounded-xl bg-slate-50 p-3 dark:bg-white/[.04]">
                  <p className="text-sm font-black">{role.name}</p>
                  {role.description ? <p className="mt-1 text-[10px] leading-4 text-slate-500">{role.description}</p> : null}
                </div>
              )) : <p className="text-xs text-slate-500">No roles available.</p>}
            </div>
          </aside>
        </section>
      </div>

      {editor ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-3 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[26px] bg-white shadow-2xl dark:bg-[#101722]">
            <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-white/10">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.17em] text-blue-600">Team member</p>
                <h2 className="mt-1 text-2xl font-black">{editor.id ? "Edit user & access" : "Add ERP user"}</h2>
              </div>
              <button type="button" onClick={() => setEditor(null)} className="rounded-xl bg-slate-100 px-3 py-2 font-black dark:bg-white/10">×</button>
            </div>
            <form onSubmit={saveUser} className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" value={editor.name} onChange={(value) => setEditor({ ...editor, name: value })} required />
                <Field label="Email / login" type="email" value={editor.email} onChange={(value) => setEditor({ ...editor, email: value })} required />
                <Field label={editor.id ? "New password (optional)" : "Password"} type="password" value={editor.password} onChange={(value) => setEditor({ ...editor, password: value })} required={!editor.id} hint="Minimum 12 characters" />
                <Field label="Confirm password" type="password" value={editor.password_confirmation} onChange={(value) => setEditor({ ...editor, password_confirmation: value })} required={!editor.id && Boolean(editor.password)} />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Assign roles</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {roles.map((role) => {
                    const checked = editor.role_ids.includes(role.id);
                    return (
                      <label key={role.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${checked ? "border-blue-300 bg-blue-50 dark:border-blue-400/30 dark:bg-blue-500/10" : "border-slate-200 dark:border-white/10"}`}>
                        <input type="checkbox" checked={checked} onChange={() => setEditor({ ...editor, role_ids: checked ? editor.role_ids.filter((id) => id !== role.id) : [...editor.role_ids, role.id] })} />
                        <span className="text-sm font-bold">{role.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-white/10">
                <span><b className="text-sm">Login access active</b><span className="mt-1 block text-[10px] text-slate-500">Turn off to immediately stop this user from using ERP.</span></span>
                <input type="checkbox" checked={editor.is_active} onChange={(e) => setEditor({ ...editor, is_active: e.target.checked })} className="h-5 w-5" />
              </label>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditor(null)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-black dark:border-white/10">Cancel</button>
                <button disabled={saving} className="rounded-xl bg-[#1768ff] px-6 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : editor.id ? "Save changes" : "Create user"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[.07] p-4"><p className="text-[9px] font-black uppercase tracking-[.15em] text-white/45">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>;
}

function Field({ label, value, onChange, type = "text", required = false, hint }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; hint?: string }) {
  return <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{label}<input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/[.05]" />{hint ? <span className="mt-1 block text-[9px] font-medium text-slate-400">{hint}</span> : null}</label>;
}
