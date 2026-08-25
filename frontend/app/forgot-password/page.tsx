'use client';

import { FormEvent, useState } from 'react';
import { AuthShell, BackToLogin } from '@/components/auth/AuthShell';
import { authRequest } from '@/lib/auth';

export default function Forgot() {
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
      await authRequest('forgot-password', {
        email: String(form.get('email')).trim(),
      });
      setMessage('If this email is registered with an active ERP account, a secure reset link has been sent. Please check Inbox and Spam.');
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Reset request could not be sent.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your registered email address. We’ll send you a secure, time-limited password reset link."
    >
      <form onSubmit={submit}>
        {message && <div className="notice success">{message}</div>}
        {error && <div className="notice error">{error}</div>}
        <label className="field">
          Registered email address
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@company.com"
          />
        </label>
        <button className="primary" disabled={loading}>
          {loading ? 'Sending…' : 'Email me a reset link'}
        </button>
      </form>
      <BackToLogin />
    </AuthShell>
  );
}
