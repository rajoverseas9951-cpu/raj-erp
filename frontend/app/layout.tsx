import "./globals.css";
import { BRAND } from "@/config/brand";
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
      <body>{children}</body>
    </html>
  );
}
