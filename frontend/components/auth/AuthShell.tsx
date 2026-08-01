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
        <div className="logo">
          <span className="logo-mark">{BRAND.mark}</span> {BRAND.productName}
        </div>
        <div className="brand-copy">
          <h1>{BRAND.tagline}</h1>
          <p>
            {BRAND.companyName} brings customers, vehicles, policies and daily
            operations into one secure workspace.
          </p>
        </div>
        <small>
          © {new Date().getFullYear()} {BRAND.productName} · Protected access
        </small>
      </section>
      <section className="form-panel">
        <div className="auth-card">
          <div className="eyebrow">Secure portal</div>
          <h2>{title}</h2>
          <p className="subtitle">{subtitle}</p>
          {children}
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
