import type { Metadata } from 'next';
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
        <main className="mx-auto min-h-screen max-w-5xl bg-white shadow-md">
          {children}
        </main>
      </body>
    </html>
  );
}