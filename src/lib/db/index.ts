/**
 * Drizzle DB client (server-side only), lazily initialised.
 *
 * Lazy init means importing `db` never requires DATABASE_URL at module-eval time
 * (so `next build` can collect page data without a live connection); the
 * connection is created on the first actual query.
 *
 * Tenancy is enforced in the application layer (every query filters by the
 * authenticated user's organizationId); RLS policies act as defence-in-depth
 * for any direct PostgREST access.
 */
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: PostgresJsDatabase<typeof schema> | null = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local");
  }
  // `prepare: false` is recommended with the Supabase transaction pooler.
  const client = postgres(connectionString, { prepare: false });
  _db = drizzle(client, { schema });
  return _db;
}

// Proxy defers connection until a query method is actually accessed.
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
