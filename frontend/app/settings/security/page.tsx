"use client";

import { FormEvent, useState } from "react";
import { profileApi } from "@/lib/profile";

const passwordFields = [
  ["current_password", "Current password"],
  ["password", "New password"],
  ["password_confirmation", "Confirm new password"],
] as const;

export default function SecuritySettings() {
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await profileApi.changePassword({
        current_password: String(form.get("current_password") ?? ""),
        password: String(form.get("password") ?? ""),
        password_confirmation: String(form.get("password_confirmation") ?? ""),
      });
      formElement.reset();
      setShowPasswords(false);
      setError("");
      setSuccess(result.message || "Password changed successfully.");
    } catch (caught) {
      setSuccess("");
      setError(caught instanceof Error ? caught.message : "Unable to change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="max-w-2xl rounded-[28px] border bg-white p-5 shadow-sm sm:p-8">
      <h2 className="text-xl font-black">Change password</h2>
      <p className="mt-1 text-sm text-slate-500">
        Use at least 10 characters with uppercase, lowercase, a number and a special character.
      </p>
      {error && <div role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {success && <div role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}
      <form onSubmit={submit} className="mt-6 space-y-5">
        {passwordFields.map(([name, label]) => (
          <label key={name} className="block">
            <span className="mb-2 block text-sm font-bold">{label}</span>
            <input
              name={name}
              type={showPasswords ? "text" : "password"}
              required
              minLength={name === "current_password" ? undefined : 10}
              autoComplete={name === "current_password" ? "current-password" : "new-password"}
              disabled={saving}
              className="w-full rounded-xl border px-4 py-3 disabled:bg-slate-50"
            />
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showPasswords} disabled={saving} onChange={(event) => setShowPasswords(event.target.checked)} />
          Show passwords
        </label>
        <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? "Updating…" : "Change password"}
        </button>
      </form>
    </section>
  );
}
