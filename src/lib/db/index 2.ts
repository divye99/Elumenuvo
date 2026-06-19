/**
 * Drizzle DB client (server-side only).
 *
 * Uses the Supabase Postgres connection string. Tenancy is enforced in the
 * application layer (every query filters by the authenticated user's
 * organizationId); RLS policies act as defence-in-depth for any direct
 * PostgREST access.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local");
}

// `prepare: false` is recommended when using the Supabase transaction pooler.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
