import './globals.css';
export const metadata={title:{default:'RAJ ERP',template:'%s | RAJ ERP'},description:'Secure, tenant-aware business operations'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body>{children}</body></html>}
