import "server-only";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "./schema";
import { getDatabaseUrl, isSupabasePoolerUrl } from "./url";
import { generateHashedPassword } from "./utils";

/**
 * Well-known anonymous diner user.
 *
 * Used to own Chat rows created by unauthenticated table sessions.
 * The UUID is deterministic so we never create duplicates.
 */
const ANONYMOUS_USER_ID = "00000000-0000-4000-8000-000000000001";
const ANONYMOUS_EMAIL = "anonymous-diner@askthemenu.local";

let cachedUserId: string | null = null;

const databaseUrl = getDatabaseUrl();
const isSupabasePooler = isSupabasePoolerUrl(databaseUrl);

const client = postgres(
  databaseUrl || "postgres://postgres:postgres@127.0.0.1:65432/postgres",
  {
    connect_timeout: 1,
    prepare: databaseUrl ? !isSupabasePooler : false,
  }
);
const db = drizzle(client);

/**
 * Returns the anonymous user ID, creating the user if it doesn't exist.
 * The result is cached in memory after the first call.
 */
export async function getAnonymousUserId(): Promise<string> {
  if (cachedUserId) {
    return cachedUserId;
  }

  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, ANONYMOUS_USER_ID))
    .limit(1);

  if (existing.length > 0) {
    cachedUserId = existing[0].id;
    return cachedUserId;
  }

  // Create the anonymous user — ON CONFLICT is handled by catching the
  // unique-violation in case of a race between two cold starts.
  try {
    await db.insert(user).values({
      id: ANONYMOUS_USER_ID,
      email: ANONYMOUS_EMAIL,
      password: generateHashedPassword("not-a-real-password"),
      isAnonymous: true,
    });
  } catch (_error) {
    // Race condition: another process created it first — that's fine.
  }

  cachedUserId = ANONYMOUS_USER_ID;
  return cachedUserId;
}
