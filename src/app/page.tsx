import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAuth } from '@/lib/auth';
import { getD1 } from '@/lib/cloudflare';

export const runtime = 'nodejs';

export default async function HomePage() {
  const requestHeaders = await headers();
  const d1 = await getD1();
  const session = await createAuth(d1).api.getSession({ headers: requestHeaders });

  if (session) {
    redirect('/dashboard');
  }
  redirect('/login');
}
