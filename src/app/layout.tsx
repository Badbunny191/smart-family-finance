import type { Metadata } from 'next';
import { DesktopSidebar } from '@/components/desktop-sidebar';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

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
