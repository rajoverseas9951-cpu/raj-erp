import Link from "next/link";
import { BRAND } from "@/config/brand";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <div className="auth-orb auth-orb-one" />
        <div className="auth-orb auth-orb-two" />
        <div className="auth-grid" />

        <div className="logo">
          <span className="logo-mark">{BRAND.mark}</span>
          <div>
            <strong>{BRAND.productName}</strong>
            <span>Insurance operations suite</span>
          </div>
        </div>

        <div className="brand-copy">
          <div className="brand-pill"><span /> SECURE BUSINESS WORKSPACE</div>
          <h1>One workspace.<br /><em>Complete control.</em></h1>
          <p>
            Customers, vehicles, policies and daily operations — organized in
            one secure workspace built for modern insurance teams.
          </p>
          <div className="auth-features">
            <div><b>01</b><span><strong>Unified records</strong><small>Everything connected</small></span></div>
            <div><b>02</b><span><strong>Secure access</strong><small>Organization protected</small></span></div>
            <div><b>03</b><span><strong>Built to scale</strong><small>Branch-ready operations</small></span></div>
          </div>
        </div>

        <div className="brand-footer">
          <span>© {new Date().getFullYear()} {BRAND.productName}</span>
          <span className="secure-status"><i /> Protected access</span>
        </div>
      </section>

      <section className="form-panel">
        <div className="form-glow" />
        <div className="auth-card">
          <div className="auth-card-head">
            <div className="eyebrow"><span /> SECURE PORTAL</div>
            <h2>{title}</h2>
            <p className="subtitle">{subtitle}</p>
          </div>
          {children}
          <div className="login-trust">
            <span className="lock-icon">⌾</span>
            <span>Your session is encrypted and securely protected.</span>
          </div>
        </div>
      </section>
    </main>
  );
}

export function BackToLogin() {
  return (
    <Link className="link back" href="/login">
      ← Back to sign in
    </Link>
  );
}
