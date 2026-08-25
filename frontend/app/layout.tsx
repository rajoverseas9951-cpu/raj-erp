import "./globals.css";
import "./premium-utilities.css";
import { BRAND } from "@/config/brand";
import { BugAgentShortcut } from "@/components/bug-agent/BugAgentShortcut";

export const metadata = {
  title: { default: BRAND.productName, template: `%s | ${BRAND.productName}` },
  description: `${BRAND.companyName} — ${BRAND.tagline}`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}<BugAgentShortcut /></body>
    </html>
  );
}
