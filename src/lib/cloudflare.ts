import { getCloudflareContext } from '@opennextjs/cloudflare';

interface CloudflareEnv {
  DB?: D1Database;
  [key: string]: unknown;
}

// Cached environment - initialized once per worker cold start
let cachedEnv: CloudflareEnv | null = null;
let contextPromise: Promise<CloudflareEnv> | null = null;

async function getCloudflareEnv(): Promise<CloudflareEnv> {
  // Fast path: return cached value synchronously
  if (cachedEnv) {
    return cachedEnv;
  }

  // Prevent race conditions during cold start
  if (!contextPromise) {
    contextPromise = (async () => {
      try {
        const { env } = await getCloudflareContext({ async: true });
        cachedEnv = env as CloudflareEnv;
        return cachedEnv;
      } catch {
        // Fallback for non-Cloudflare runtimes (local dev)
        cachedEnv = process.env as unknown as CloudflareEnv;
        return cachedEnv;
      }
    })();
  }

  return contextPromise;
}

export async function getD1(): Promise<D1Database> {
  const env = await getCloudflareEnv();
  const d1 = env.DB;
  if (!d1) {
    throw new Error('D1 binding DB is missing. Run this route through Cloudflare or Wrangler.');
  }
  return d1;
}

export function invalidateCache(): void {
  cachedEnv = null;
  contextPromise = null;
}
