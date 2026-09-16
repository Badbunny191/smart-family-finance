import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from '@/db/client';
import * as schema from '@/db/schema';

// Singleton auth instance - initialized once per worker cold start
let authInstance: ReturnType<typeof betterAuth> | null = null;

export function createAuth(d1: D1Database) {
  // Fast path: return cached instance
  if (authInstance) {
    return authInstance;
  }

  const db = getDb(d1);

  authInstance = betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.users,
        authSession: schema.sessions,
        authAccount: schema.accountsAuth,
        authVerification: schema.verifications,
      },
    }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: true,
          defaultValue: 'viewer',
          input: false,
        },
      },
    },
    session: {
      modelName: 'authSession',
      expiresIn: 60 * 60 * 24 * 30, // 30 Days
      updateAge: 60 * 60 * 24, // 1 Day
      cookie: {
        name: 'better-auth.session_token',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      },
    },
    account: {
      modelName: 'authAccount',
    },
    verification: {
      modelName: 'authVerification',
    },
  });

  return authInstance;
}

export function invalidateAuthCache(): void {
  authInstance = null;
}
