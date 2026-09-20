import type { Metadata } from 'next';
import type { Viewport } from "next";
import { DesktopSidebar } from '@/components/desktop-sidebar';
import { ToastProvider } from '@/components/ui/toast';
import { GlobalErrorLogger } from '@/components/global-error-logger';
import './globals.css';

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#10b981",
};

export const metadata: Metadata = {
  title: 'Smart Family Finance',
  description: 'Mobile-first family finance tracking application',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Finance',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'msapplication-TileColor': '#10b981',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#10b981" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Finance" />
        <link rel="apple-touch-icon" href="/logo.svg" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.svg" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.svg" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <GlobalErrorLogger />
        <ToastProvider>
          <div className="flex min-h-screen w-full">
            <DesktopSidebar />
            <main className="min-h-screen w-full max-w-5xl flex-1 bg-white shadow-md md:max-w-6xl md:shadow-none md:bg-transparent xl:max-w-7xl">
              {children}
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
