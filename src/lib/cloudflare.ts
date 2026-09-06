import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function getD1(): Promise<D1Database> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const d1 = (env as unknown as { DB?: D1Database }).DB;
    if (d1) {
      return d1;
    }
  } catch {
    // Fall back to a process environment binding for non-Cloudflare runtimes.
  }

  const d1 = (process.env as unknown as { DB?: D1Database }).DB;
  if (!d1) {
    throw new Error('D1 binding DB is missing. Run this route through Cloudflare or Wrangler.');
  }
  return d1;
}