'use client';

import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthShell, BackToLogin } from '@/components/auth/AuthShell';
import { authRequest } from '@/lib/auth';

export default function Reset() {
  const q = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    const form = new FormData(e.currentTarget);

    try {
      await authRequest('reset-password', {
        tenant_id: String(form.get('tenant_id')),
        email: String(form.get('email')),
        token: String(form.get('token')),
        password: String(form.get('password')),
        password_confirmation: String(form.get('password_confirmation')),
      });
      setMessage('Password updated successfully. You can now sign in with your new password.');
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Reset failed.');
    } finally {
      setLoading(false);
    }
  }

  const email = q.get('email') ?? '';
  const tenantId = q.get('tenant_id') ?? '';
  const token = q.get('token') ?? '';

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={email ? `Resetting password for ${email}` : 'Choose a strong new password for your ERP account.'}
    >
      <form onSubmit={submit}>
        {message && <div className="notice success">{message}</div>}
        {error && <div className="notice error">{error}</div>}
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="tenant_id" value={tenantId} />
        <input type="hidden" name="email" value={email} />
        <label className="field">
          New password
          <input name="password" type="password" minLength={12} required autoComplete="new-password" />
        </label>
        <label className="field">
          Confirm password
          <input name="password_confirmation" type="password" minLength={12} required autoComplete="new-password" />
        </label>
        <button className="primary" disabled={loading || !token || !tenantId || !email}>
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
      <BackToLogin />
    </AuthShell>
  );
}
