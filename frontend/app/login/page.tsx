"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { authRequest } from "@/lib/auth";

const TENANT_KEY = "vimawallah_last_tenant";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showOrg, setShowOrg] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(TENANT_KEY)?.trim() ?? "";
    if (saved) {
      setTenantId(saved);
      setShowOrg(false);
    }
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setSuccess("");
    const f = new FormData(e.currentTarget);
    const tenant = String(f.get("tenant_id") ?? "").trim();

    if (!tenant) {
      setShowOrg(true);
      setError("Enter your organization access ID to continue.");
      setLoading(false);
      return;
    }

    try {
      const data = await authRequest<{ token: string; user: unknown }>("login", {
        tenant_id: tenant,
        email: String(f.get("email")),
        password: String(f.get("password")),
        device_name: "web",
      });
      localStorage.setItem(TENANT_KEY, tenant);
      sessionStorage.setItem("raj_erp_token", data.token);
      sessionStorage.setItem("vimawallah_user", JSON.stringify(data.user));
      setSuccess("Signed in successfully. Opening your workspace…");
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo") ?? params.get("next");
      window.location.href = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";
    } catch (x) {
      setError(x instanceof Error ? x.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AuthShell title="Welcome back" subtitle="Sign in and continue where you left off.">
        <form onSubmit={submit} className="login-form">
          {error && <div className="notice error" role="alert">{error}</div>}
          {success && <div className="notice success" role="status">{success}</div>}

          <div className="org-access">
            <button type="button" className="org-access-toggle" onClick={() => setShowOrg((v) => !v)} aria-expanded={showOrg}>
              <span className="org-access-icon">V</span>
              <span className="org-access-copy">
                <strong>Organization access</strong>
                <small>{tenantId ? "Organization remembered on this device" : "Required for secure workspace access"}</small>
              </span>
              <span className={`org-chevron ${showOrg ? "open" : ""}`}>⌄</span>
            </button>
            <div className={`org-access-field ${showOrg ? "open" : ""}`}>
              <label className="field compact-field">
                Organization ID
                <input
                  name="tenant_id"
                  required
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="Organization UUID"
                  autoComplete="organization"
                />
              </label>
            </div>
          </div>

          <label className="field login-field">
            <span>Email address</span>
            <span className="input-shell">
              <span className="field-icon">@</span>
              <input name="email" type="email" required autoComplete="email" placeholder="name@company.com" />
            </span>
          </label>

          <label className="field login-field">
            <span className="field-label-row"><span>Password</span><Link className="link inline-forgot" href="/forgot-password">Forgot password?</Link></span>
            <span className="input-shell">
              <span className="field-icon">•</span>
              <input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Enter your password" />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)}>{showPassword ? "Hide" : "Show"}</button>
            </span>
          </label>

          <button className="primary premium-login-button" disabled={loading}>
            <span>{loading ? "Signing in…" : "Enter workspace"}</span>
            {!loading && <span className="button-arrow">→</span>}
          </button>

          <div className="login-meta">
            <span><i className="status-dot" /> Secure encrypted session</span>
            <Link href="/forgot-password">Account help</Link>
          </div>
        </form>
      </AuthShell>

      <style jsx global>{`
        .auth-shell{background:#f5f8ff!important}
        .brand-panel{position:relative;background:linear-gradient(145deg,#06152f 0%,#0a2860 52%,#0b3877 100%)!important}
        .brand-panel:after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 18% 16%,rgba(63,137,255,.28),transparent 27%),radial-gradient(circle at 82% 72%,rgba(38,208,255,.14),transparent 28%),linear-gradient(115deg,transparent 45%,rgba(255,255,255,.035) 45%,rgba(255,255,255,.035) 46%,transparent 46%);background-size:auto,auto,72px 72px}
        .brand-panel>*{position:relative;z-index:1}
        .logo-mark{background:linear-gradient(145deg,#67b0ff,#2565e8)!important;box-shadow:0 16px 40px rgba(30,106,255,.28)!important}
        .brand-pill{background:rgba(255,255,255,.075)!important;border-color:rgba(255,255,255,.12)!important;box-shadow:inset 0 1px rgba(255,255,255,.07)}
        .brand-copy h1{letter-spacing:-.055em!important}
        .brand-copy h1 em{background:linear-gradient(90deg,#74b9ff,#8cecff);-webkit-background-clip:text;background-clip:text;color:transparent!important}
        .auth-features>div{background:rgba(255,255,255,.055)!important;border:1px solid rgba(255,255,255,.09)!important;box-shadow:inset 0 1px rgba(255,255,255,.035)}
        .form-panel{position:relative;background:radial-gradient(circle at 50% 44%,rgba(70,125,255,.10),transparent 38%),linear-gradient(135deg,#f8fbff,#eef4ff)!important}
        .form-panel:before{border-color:rgba(89,121,176,.12)!important;background:rgba(255,255,255,.18)!important}
        .auth-card{border:1px solid rgba(203,214,232,.78)!important;background:rgba(255,255,255,.88)!important;box-shadow:0 28px 80px rgba(33,62,116,.14),inset 0 1px #fff!important;backdrop-filter:blur(22px)}
        .auth-card-head .eyebrow{color:#2467db!important}
        .auth-card h2{letter-spacing:-.045em!important;color:#102441!important}
        .subtitle{color:#8190a9!important}
        .login-form{display:block}
        .org-access{margin:0 0 14px;border:1px solid #e0e7f1;border-radius:16px;background:#f8faff;overflow:hidden;transition:.2s ease}
        .org-access:focus-within{border-color:#96b9ff;box-shadow:0 0 0 4px rgba(50,111,234,.08)}
        .org-access-toggle{width:100%;display:flex;align-items:center;gap:11px;border:0;background:transparent;padding:11px 12px;text-align:left;cursor:pointer;color:#263a5a}
        .org-access-icon{display:grid;width:32px;height:32px;place-items:center;border-radius:10px;background:linear-gradient(145deg,#2569ef,#7657ef);color:#fff;font-size:11px;font-weight:800;box-shadow:0 8px 18px rgba(65,92,223,.18)}
        .org-access-copy{min-width:0;flex:1}
        .org-access-copy strong{display:block;font-size:10px;font-weight:750;color:#263a5a}
        .org-access-copy small{display:block;margin-top:2px;font-size:8px;color:#93a0b3}
        .org-chevron{font-size:16px;color:#8b99ad;transform:rotate(0);transition:.2s ease}
        .org-chevron.open{transform:rotate(180deg)}
        .org-access-field{display:grid;grid-template-rows:0fr;transition:grid-template-rows .22s ease}
        .org-access-field>*{overflow:hidden}
        .org-access-field.open{grid-template-rows:1fr}
        .compact-field{margin:0!important;padding:0 12px 11px}
        .compact-field input{height:42px!important;margin-top:6px!important;background:#fff!important}
        .login-field{margin:13px 0!important;color:#283b5a!important;font-size:10px!important;font-weight:700!important}
        .field-label-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .inline-forgot{font-size:9px!important;font-weight:700!important}
        .input-shell{position:relative;display:block;margin-top:6px}
        .input-shell input{width:100%;height:50px!important;margin:0!important;padding:0 58px 0 42px!important;border:1px solid #dce5f2!important;border-radius:14px!important;background:#f7faff!important;color:#142842!important;font-size:12px!important;font-weight:600!important;box-shadow:inset 0 1px 2px rgba(40,65,105,.025)!important;transition:.18s ease!important}
        .input-shell input:focus{background:#fff!important;border-color:#5a91f4!important;box-shadow:0 0 0 4px rgba(54,113,232,.10),0 12px 30px rgba(44,82,151,.07)!important}
        .field-icon{position:absolute;left:14px;top:50%;z-index:2;transform:translateY(-50%);display:grid;width:19px;height:19px;place-items:center;border-radius:7px;background:#e9f1ff;color:#3a73d7;font-size:10px;font-weight:800}
        .password-toggle{position:absolute;right:11px;top:50%;z-index:2;transform:translateY(-50%);border:0;background:transparent;color:#3b6fc6;font-size:9px;font-weight:750;cursor:pointer;padding:7px}
        .premium-login-button{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:0 18px!important;border-radius:14px!important;background:linear-gradient(90deg,#1f58bd,#2d79ea)!important;box-shadow:0 14px 30px rgba(37,99,207,.22)!important;transition:.2s ease!important}
        .premium-login-button:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 18px 34px rgba(37,99,207,.27)!important}
        .button-arrow{display:grid;width:25px;height:25px;place-items:center;border-radius:9px;background:rgba(255,255,255,.14);font-size:14px}
        .login-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:13px;padding:0 2px;color:#8a98ac;font-size:8px;font-weight:600}
        .login-meta>span{display:flex;align-items:center;gap:6px}.login-meta a{color:#4774c6;text-decoration:none;font-weight:700}
        .status-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#24c985;box-shadow:0 0 9px rgba(36,201,133,.55)}
        .login-trust{display:none!important}

        @media (min-width:851px){
          html,body{height:100%;overflow:hidden!important}
          .auth-shell{width:100vw;height:100dvh;min-height:0!important;grid-template-columns:minmax(0,1.03fr) minmax(470px,.97fr)!important;overflow:hidden!important}
          .brand-panel{min-height:0!important;height:100dvh;padding:clamp(28px,3.8vh,46px) clamp(42px,4.8vw,74px)!important}
          .brand-copy{margin:0!important;max-width:650px!important}
          .brand-copy h1{font-size:clamp(44px,4.25vw,70px)!important;margin:clamp(16px,2vh,24px) 0 clamp(11px,1.5vh,17px)!important;line-height:.96!important}
          .brand-copy>p{font-size:clamp(13px,1.05vw,16px)!important;line-height:1.62!important;max-width:585px!important}
          .auth-features{margin-top:clamp(20px,2.7vh,32px)!important;gap:11px!important}
          .auth-features>div{padding:13px!important;border-radius:15px!important}
          .form-panel{height:100dvh;min-height:0!important;padding:clamp(20px,3vh,38px) clamp(32px,4vw,64px)!important;overflow:hidden!important}
          .form-panel:before{inset:18px!important;border-radius:30px!important}
          .auth-card{max-width:465px!important;max-height:calc(100dvh - 56px);padding:clamp(25px,3.2vh,36px) clamp(30px,2.7vw,40px) clamp(22px,2.8vh,30px)!important;border-radius:26px!important;overflow:hidden}
          .auth-card-head{margin-bottom:15px!important}
          .auth-card h2{font-size:clamp(32px,2.7vw,40px)!important;margin:8px 0 6px!important}
          .subtitle{font-size:12px!important;line-height:1.45!important}
          .primary{height:50px!important;margin-top:14px!important}
          .notice{margin:9px 0!important;padding:9px 11px!important}
        }
        @media (min-width:851px) and (max-height:760px){
          .logo-mark{width:44px!important;height:44px!important}.logo strong{font-size:19px!important}.brand-pill{padding:6px 10px!important}.brand-copy h1{font-size:clamp(38px,3.8vw,54px)!important}.auth-features>div{padding:9px 10px!important}.auth-card{padding-top:20px!important;padding-bottom:18px!important}.auth-card-head{margin-bottom:10px!important}.login-field{margin:10px 0!important}.input-shell input{height:44px!important}.premium-login-button{height:45px!important}.org-access-toggle{padding:9px 11px}.org-access-icon{width:29px;height:29px}}
        @media (max-width:850px){
          .brand-panel{padding-bottom:42px!important}.brand-copy h1{font-size:42px!important}.auth-features{grid-template-columns:1fr!important}.form-panel{padding:22px 16px 34px!important}.form-panel:before{inset:8px!important}.auth-card{border-radius:24px!important;padding:26px 20px!important}.login-meta{align-items:flex-start;flex-direction:column;gap:7px}}
      `}</style>
    </>
  );
}
