import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type AppDatabase = DrizzleD1Database<typeof schema>;

let dbInstance: AppDatabase | null = null;

export function getDb(d1: D1Database): AppDatabase {
  if (!d1) {
    console.error('[DB] D1 is undefined!');
    throw new Error('D1Database binding is missing.');
  }
  if (!dbInstance) {
    console.error('[DB] Creating new drizzle instance');
    dbInstance = drizzle(d1, { schema });
    console.error('[DB] Drizzle instance created');
  }
  return dbInstance;
}