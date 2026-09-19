// Use Cloudflare context from open-next middleware
// This key is set by .open-next/cloudflare/init.js
const CLOUDFLARE_CONTEXT_KEY = Symbol.for("__cloudflare-context__");

interface CloudflareEnv {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  ASSETS?: unknown;
  [key: string]: unknown;
}

export async function getD1(): Promise<D1Database> {
  const ctx = getCloudflareContext();
  const d1 = ctx.env.DB;
  if (!d1) {
    throw new Error('D1 binding DB is missing');
  }
  return d1;
}

export function getR2(): R2Bucket {
  const ctx = getCloudflareContext();
  const bucket = ctx.env.BUCKET;
  if (!bucket) {
    throw new Error('R2 binding BUCKET is missing');
  }
  return bucket;
}

function getCloudflareContext(): { env: CloudflareEnv; cf?: unknown; ctx?: unknown } {
  const ctx = (globalThis as Record<symbol, unknown>)[CLOUDFLARE_CONTEXT_KEY] as {
    env: CloudflareEnv;
    cf?: unknown;
    ctx?: unknown;
  } | undefined;
  
  if (!ctx) {
    throw new Error('Cloudflare context not available');
  }
  
  return ctx;
}

export function invalidateCache(): void {
  // No-op for this implementation
}
