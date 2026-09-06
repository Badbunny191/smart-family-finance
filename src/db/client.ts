import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type AppDatabase = DrizzleD1Database<typeof schema>;

let dbInstance: AppDatabase | null = null;

export function getDb(d1: D1Database): AppDatabase {
  if (!d1) {
    throw new Error('D1Database binding is missing.');
  }
  if (!dbInstance) {
    dbInstance = drizzle(d1, { schema });
  }
  return dbInstance;
}