"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { BRAND } from "@/config/brand";
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
    <main className="portal-page">
      <div className="portal-aurora portal-aurora-a" />
      <div className="portal-aurora portal-aurora-b" />
      <div className="portal-grid" />

      <section className="portal-shell">
        <div className="portal-brand">
          <div className="brand-topline">
            <div className="brand-logo-mark">{BRAND.mark}</div>
            <div>
              <strong>{BRAND.productName}</strong>
              <span>Insurance operations suite</span>
            </div>
          </div>

          <div className="brand-content">
            <div className="live-pill"><i /> LIVE BUSINESS WORKSPACE</div>
            <h1>Run insurance.<br /><em>Without the chaos.</em></h1>
            <p>
              Customers, vehicles, policies, collections and daily follow-ups —
              one secure command center for your team.
            </p>

            <div className="workspace-preview">
              <div className="preview-head">
                <div>
                  <small>WORKSPACE PULSE</small>
                  <strong>Everything important, one view.</strong>
                </div>
                <span className="preview-live"><i /> Live</span>
              </div>
              <div className="preview-grid">
                <div><span>Renewals</span><strong>Follow up</strong><i className="dot amber" /></div>
                <div><span>Collections</span><strong>Track dues</strong><i className="dot cyan" /></div>
                <div><span>Claims</span><strong>Stay ahead</strong><i className="dot violet" /></div>
              </div>
            </div>
          </div>

          <div className="brand-bottom">
            <span>© {new Date().getFullYear()} {BRAND.brandName}</span>
            <span><i /> Protected access</span>
          </div>
        </div>

        <div className="portal-login">
          <div className="login-panel">
            <div className="login-heading">
              <div className="secure-label"><i /> SECURE PORTAL</div>
              <h2>Welcome back</h2>
              <p>Enter your workspace and continue where you left off.</p>
            </div>

            <form onSubmit={submit} className="login-form">
              {error && <div className="login-notice error" role="alert">{error}</div>}
              {success && <div className="login-notice success" role="status">{success}</div>}

              <div className={`org-card ${showOrg ? "open" : ""}`}>
                <button type="button" onClick={() => setShowOrg((v) => !v)} className="org-toggle" aria-expanded={showOrg}>
                  <span className="org-logo">V</span>
                  <span className="org-copy">
                    <strong>Organization access</strong>
                    <small>{tenantId ? "Remembered on this device" : "Required for secure sign-in"}</small>
                  </span>
                  <span className="org-arrow">⌄</span>
                </button>
                <div className="org-body">
                  <label>
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

              <label className="login-field">
                <span>Email address</span>
                <div className="input-wrap">
                  <i className="input-icon">@</i>
                  <input name="email" type="email" required autoComplete="email" placeholder="name@company.com" />
                </div>
              </label>

              <label className="login-field">
                <span className="field-row">
                  <span>Password</span>
                  <Link href="/forgot-password">Forgot password?</Link>
                </span>
                <div className="input-wrap">
                  <i className="input-icon">•</i>
                  <input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Enter your password" />
                  <button type="button" className="show-password" onClick={() => setShowPassword((v) => !v)}>{showPassword ? "Hide" : "Show"}</button>
                </div>
              </label>

              <button className="login-cta" disabled={loading}>
                <span>{loading ? "Signing in…" : "Enter workspace"}</span>
                <b>{loading ? "•••" : "→"}</b>
              </button>

              <div className="login-footer-row">
                <span><i /> Encrypted session</span>
                <Link href="/forgot-password">Account help</Link>
              </div>
            </form>
          </div>
        </div>
      </section>

      <style jsx global>{`
        html,body{margin:0;background:#061027}
        body{overflow-x:hidden}
        .portal-page{position:relative;min-height:100dvh;display:grid;place-items:center;overflow:hidden;padding:24px;background:radial-gradient(circle at 16% 10%,rgba(43,116,255,.22),transparent 28%),radial-gradient(circle at 88% 86%,rgba(94,78,255,.18),transparent 30%),linear-gradient(145deg,#050b18 0%,#081731 48%,#0a1f42 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .portal-grid{position:absolute;inset:0;opacity:.18;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:46px 46px;mask-image:linear-gradient(to bottom,black,transparent 88%)}
        .portal-aurora{position:absolute;border-radius:999px;filter:blur(100px);pointer-events:none}
        .portal-aurora-a{width:440px;height:440px;left:-120px;top:-140px;background:rgba(30,112,255,.30)}
        .portal-aurora-b{width:520px;height:520px;right:-160px;bottom:-220px;background:rgba(91,73,255,.24)}
        .portal-shell{position:relative;z-index:2;width:min(1180px,calc(100vw - 48px));min-height:690px;display:grid;grid-template-columns:1.08fr .92fr;overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:34px;background:rgba(10,20,43,.72);box-shadow:0 44px 120px rgba(0,0,0,.42),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(28px)}
        .portal-brand{position:relative;display:flex;min-width:0;flex-direction:column;justify-content:space-between;padding:34px 38px;color:white;overflow:hidden;background:radial-gradient(circle at 14% 18%,rgba(48,123,255,.34),transparent 30%),radial-gradient(circle at 90% 80%,rgba(0,217,255,.15),transparent 27%),linear-gradient(145deg,rgba(10,29,66,.98),rgba(8,42,96,.92))}
        .portal-brand:after{content:"";position:absolute;width:520px;height:520px;right:-190px;top:110px;border:1px solid rgba(255,255,255,.08);border-radius:50%;box-shadow:0 0 0 65px rgba(255,255,255,.018),0 0 0 130px rgba(255,255,255,.012);pointer-events:none}
        .brand-topline,.brand-content,.brand-bottom{position:relative;z-index:2}
        .brand-topline{display:flex;align-items:center;gap:13px}.brand-logo-mark{display:grid;width:48px;height:48px;place-items:center;border-radius:16px;background:linear-gradient(145deg,#69b6ff,#2d67eb 65%,#765af0);font-size:18px;font-weight:850;box-shadow:0 16px 34px rgba(28,99,234,.32)}.brand-topline strong{display:block;font-size:18px;letter-spacing:-.025em}.brand-topline span{display:block;margin-top:4px;color:#6fcaff;font-size:8px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
        .brand-content{max-width:570px;margin:auto 0}.live-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 11px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.065);color:#a7d9ff;font-size:8px;font-weight:800;letter-spacing:.16em}.live-pill i,.brand-bottom i,.preview-live i,.login-footer-row i,.secure-label i{width:6px;height:6px;border-radius:50%;background:#35d39a;box-shadow:0 0 10px rgba(53,211,154,.72)}
        .brand-content h1{margin:22px 0 14px;font-size:clamp(44px,4.5vw,68px);line-height:.96;letter-spacing:-.06em;font-weight:760}.brand-content h1 em{font-style:normal;background:linear-gradient(90deg,#78b9ff,#70e8ff 70%,#9b8cff);-webkit-background-clip:text;background-clip:text;color:transparent}.brand-content>p{max-width:525px;margin:0;color:rgba(218,233,255,.70);font-size:14px;line-height:1.7}
        .workspace-preview{margin-top:26px;padding:17px;border:1px solid rgba(255,255,255,.10);border-radius:22px;background:rgba(255,255,255,.055);box-shadow:inset 0 1px rgba(255,255,255,.04);backdrop-filter:blur(14px)}.preview-head{display:flex;align-items:center;justify-content:space-between;gap:14px}.preview-head small{display:block;color:#6fcaff;font-size:7px;font-weight:850;letter-spacing:.16em}.preview-head strong{display:block;margin-top:4px;font-size:12px}.preview-live{display:inline-flex;align-items:center;gap:6px;color:#85e5c0;font-size:8px;font-weight:750}.preview-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.preview-grid>div{position:relative;padding:12px;border-radius:14px;background:rgba(5,15,36,.34);border:1px solid rgba(255,255,255,.055)}.preview-grid span{display:block;color:#7c93b5;font-size:7px}.preview-grid strong{display:block;margin-top:5px;font-size:10px}.dot{position:absolute;right:10px;top:12px;width:6px;height:6px;border-radius:50%}.dot.amber{background:#fbbf24}.dot.cyan{background:#22d3ee}.dot.violet{background:#a78bfa}
        .brand-bottom{display:flex;align-items:center;justify-content:space-between;gap:20px;color:#6783aa;font-size:8px}.brand-bottom span:last-child{display:flex;align-items:center;gap:7px;color:#79a0c9}
        .portal-login{position:relative;display:grid;place-items:center;padding:36px;background:radial-gradient(circle at 50% 42%,rgba(66,111,255,.10),transparent 42%),linear-gradient(155deg,rgba(245,249,255,.98),rgba(231,239,252,.96))}.portal-login:before{content:"";position:absolute;inset:18px;border:1px solid rgba(63,92,143,.08);border-radius:26px;pointer-events:none}
        .login-panel{position:relative;z-index:2;width:min(100%,410px);padding:30px;border:1px solid rgba(198,210,229,.78);border-radius:26px;background:rgba(255,255,255,.88);box-shadow:0 28px 72px rgba(45,68,115,.14),inset 0 1px #fff;backdrop-filter:blur(22px)}
        .secure-label{display:flex;align-items:center;gap:8px;color:#2469d9;font-size:8px;font-weight:850;letter-spacing:.17em}.secure-label i{background:#55a4ff;box-shadow:0 0 9px rgba(85,164,255,.5)}.login-heading h2{margin:10px 0 5px;color:#102441;font-size:34px;line-height:1;letter-spacing:-.045em}.login-heading p{margin:0 0 18px;color:#8795aa;font-size:11px;line-height:1.5}
        .login-notice{margin:0 0 12px;padding:10px 12px;border-radius:12px;font-size:9px;font-weight:650}.login-notice.error{background:#fff1f2;color:#be123c;border:1px solid #fecdd3}.login-notice.success{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}
        .org-card{margin-bottom:14px;overflow:hidden;border:1px solid #e0e7f2;border-radius:15px;background:#f7f9fd;transition:.2s ease}.org-card:focus-within{border-color:#93b8ff;box-shadow:0 0 0 4px rgba(57,115,232,.08)}.org-toggle{width:100%;display:flex;align-items:center;gap:10px;padding:10px 11px;border:0;background:transparent;text-align:left;cursor:pointer}.org-logo{display:grid;width:31px;height:31px;place-items:center;border-radius:10px;background:linear-gradient(145deg,#2e6ff3,#7656f1);color:white;font-size:10px;font-weight:850;box-shadow:0 8px 18px rgba(64,91,220,.18)}.org-copy{min-width:0;flex:1}.org-copy strong{display:block;color:#273a5a;font-size:9px}.org-copy small{display:block;margin-top:2px;color:#96a2b3;font-size:7px}.org-arrow{color:#8190a4;font-size:14px;transition:.2s}.org-card.open .org-arrow{transform:rotate(180deg)}.org-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .22s ease}.org-body>label{overflow:hidden}.org-card.open .org-body{grid-template-rows:1fr}.org-body label{display:block;padding:0 11px 10px;color:#43536d;font-size:8px;font-weight:750}.org-body input{box-sizing:border-box;width:100%;height:39px;margin-top:5px;padding:0 11px;border:1px solid #dbe3ee;border-radius:11px;background:white;color:#18304f;outline:none;font-size:10px}
        .login-field{display:block;margin:12px 0;color:#2d405f;font-size:9px;font-weight:760}.field-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.field-row a{color:#356fd1;text-decoration:none;font-size:8px}.input-wrap{position:relative;margin-top:6px}.input-wrap input{box-sizing:border-box;width:100%;height:48px;padding:0 55px 0 40px;border:1px solid #dce5f1;border-radius:13px;background:#f6f9fe;color:#162c49;outline:none;font-size:11px;font-weight:600;transition:.18s ease}.input-wrap input:focus{border-color:#5f94ef;background:white;box-shadow:0 0 0 4px rgba(50,108,224,.09),0 10px 26px rgba(50,78,132,.06)}.input-icon{position:absolute;left:13px;top:50%;transform:translateY(-50%);display:grid;width:18px;height:18px;place-items:center;border-radius:6px;background:#e7f0ff;color:#3971d5;font-size:9px;font-style:normal;font-weight:850}.show-password{position:absolute;right:10px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#356ecb;font-size:8px;font-weight:800;cursor:pointer}
        .login-cta{width:100%;height:49px;margin-top:15px;display:flex;align-items:center;justify-content:space-between;padding:0 15px;border:0;border-radius:13px;background:linear-gradient(90deg,#1e58bc,#2e7deb);color:white;font-size:10px;font-weight:800;cursor:pointer;box-shadow:0 14px 28px rgba(36,98,207,.22);transition:.2s ease}.login-cta:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 18px 34px rgba(36,98,207,.28)}.login-cta:disabled{opacity:.7;cursor:wait}.login-cta b{display:grid;width:25px;height:25px;place-items:center;border-radius:8px;background:rgba(255,255,255,.14);font-size:13px}
        .login-footer-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;color:#8d9aaa;font-size:7px}.login-footer-row span{display:flex;align-items:center;gap:6px}.login-footer-row a{color:#4973bd;text-decoration:none;font-weight:750}
        @media (max-width:900px){.portal-page{padding:14px;overflow:auto}.portal-shell{width:min(700px,calc(100vw - 28px));grid-template-columns:1fr;min-height:0}.portal-brand{padding:26px}.brand-content{margin:46px 0 28px}.brand-content h1{font-size:46px}.workspace-preview{display:none}.brand-bottom{margin-top:22px}.portal-login{padding:28px 20px}.login-panel{width:min(100%,430px);box-sizing:border-box}}
        @media (max-width:560px){.portal-page{padding:0;background:#07152f}.portal-shell{width:100%;border:0;border-radius:0;box-shadow:none}.portal-brand{padding:22px 20px 26px}.brand-topline .brand-logo-mark{width:42px;height:42px}.brand-content{margin:34px 0 12px}.brand-content h1{font-size:38px}.brand-content>p{font-size:12px}.brand-bottom{display:none}.portal-login{padding:18px 14px 28px}.portal-login:before{display:none}.login-panel{padding:24px 20px;border-radius:22px}.login-heading h2{font-size:31px}}
      `}</style>
    </main>
  );
}
