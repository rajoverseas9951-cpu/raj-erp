"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { authRequest } from "@/lib/auth";

export default function Login() {
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setSuccess("");
    const f = new FormData(e.currentTarget);
    try {
      const data = await authRequest<{ token: string; user: unknown }>("login", {
        tenant_id: String(f.get("tenant_id")),
        email: String(f.get("email")),
        password: String(f.get("password")),
        device_name: "web",
      });
      sessionStorage.setItem("raj_erp_token", data.token);
      sessionStorage.setItem("vimawallah_user", JSON.stringify(data.user));
      setSuccess("Signed in successfully. Your secure session is ready.");
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      window.location.href = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";
    } catch (x) {
      setError(x instanceof Error ? x.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AuthShell
        title="Welcome back"
        subtitle="Sign in with your organization account to continue."
      >
        <form onSubmit={submit}>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="notice success" role="status">
              {success}
            </div>
          )}
          <label className="field">
            Organization ID
            <input
              name="tenant_id"
              required
              placeholder="Your organization UUID"
              autoComplete="organization"
            />
          </label>
          <label className="field">
            Email address
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@company.com"
            />
          </label>
          <label className="field">
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter your password"
            />
          </label>
          <div className="row">
            <span />
            <Link className="link" href="/forgot-password">
              Forgot password?
            </Link>
          </div>
          <button className="primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in securely"}
          </button>
        </form>
      </AuthShell>

      <style jsx global>{`
        @media (min-width: 851px) {
          html,
          body {
            height: 100%;
            overflow: hidden !important;
          }

          .auth-shell {
            width: 100vw;
            height: 100dvh;
            min-height: 0 !important;
            grid-template-columns: minmax(0, 1.08fr) minmax(420px, 0.92fr) !important;
            overflow: hidden !important;
          }

          .brand-panel {
            min-height: 0 !important;
            height: 100dvh;
            padding: clamp(26px, 3.4vh, 44px) clamp(38px, 4.4vw, 68px) !important;
          }

          .brand-copy {
            margin: 0 !important;
            max-width: 620px !important;
          }

          .brand-copy h1 {
            font-size: clamp(42px, 4.1vw, 66px) !important;
            margin: clamp(14px, 2vh, 22px) 0 clamp(10px, 1.7vh, 18px) !important;
            line-height: 0.98 !important;
          }

          .brand-copy > p {
            font-size: clamp(13px, 1.08vw, 16px) !important;
            line-height: 1.58 !important;
            max-width: 570px !important;
          }

          .auth-features {
            margin-top: clamp(18px, 2.5vh, 30px) !important;
            gap: 10px !important;
          }

          .auth-features > div {
            padding: 12px 12px !important;
            border-radius: 13px !important;
          }

          .form-panel {
            height: 100dvh;
            min-height: 0 !important;
            padding: clamp(20px, 3vh, 36px) clamp(30px, 4vw, 60px) !important;
            overflow: hidden !important;
          }

          .form-panel:before {
            inset: 16px !important;
            border-radius: 24px !important;
          }

          .auth-card {
            max-width: 455px !important;
            max-height: calc(100dvh - 52px);
            padding: clamp(24px, 3.2vh, 34px) clamp(28px, 2.5vw, 38px) clamp(20px, 2.6vh, 28px) !important;
            border-radius: 22px !important;
            overflow: hidden;
          }

          .auth-card-head {
            margin-bottom: clamp(14px, 2vh, 22px) !important;
          }

          .auth-card h2 {
            font-size: clamp(30px, 2.6vw, 38px) !important;
            margin: 8px 0 6px !important;
          }

          .subtitle {
            font-size: 13px !important;
            line-height: 1.45 !important;
          }

          .field {
            margin: clamp(10px, 1.55vh, 15px) 0 !important;
            font-size: 11px !important;
          }

          .field input {
            height: clamp(44px, 6.2vh, 50px) !important;
            margin-top: 6px !important;
            border-radius: 12px !important;
          }

          .primary {
            height: clamp(46px, 6.4vh, 52px) !important;
            margin-top: clamp(12px, 1.7vh, 16px) !important;
          }

          .login-trust {
            margin-top: clamp(14px, 1.9vh, 20px) !important;
            padding-top: clamp(12px, 1.7vh, 17px) !important;
          }

          .notice {
            margin: 10px 0 !important;
            padding: 10px 12px !important;
          }
        }

        @media (min-width: 851px) and (max-height: 760px) {
          .logo-mark {
            width: 44px !important;
            height: 44px !important;
          }

          .logo strong {
            font-size: 19px !important;
          }

          .brand-pill {
            padding: 6px 10px !important;
          }

          .brand-copy h1 {
            font-size: clamp(38px, 3.8vw, 54px) !important;
          }

          .auth-features > div {
            padding: 9px 10px !important;
          }

          .auth-card {
            padding-top: 22px !important;
            padding-bottom: 18px !important;
          }

          .login-trust {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
