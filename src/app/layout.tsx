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
};

export const metadata: Metadata = {
  title: 'Smart Family Finance',
  description: 'Mobile-first family finance tracking application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
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
