import { eq } from "drizzle-orm";
import type { Db } from "@shared/db/client";
import { users } from "@shared/db/schema";
import { hashPassword, verifyPassword } from "./password";
import { createSession, deleteSession } from "./sessions";

// Compared against when the username doesn't exist, so response time doesn't reveal valid usernames.
const DUMMY_HASH = hashPassword("dummy-password");

/** Checks a username and password. Returns the user, or null for either kind of mismatch. */
export function authenticate(
  db: Db,
  username: string,
  password: string,
): { id: string; username: string } | null {
  const row = db.select().from(users).where(eq(users.username, username)).get();
  const ok = verifyPassword(password, row?.passwordHash ?? DUMMY_HASH);
  return row && ok ? { id: row.id, username: row.username } : null;
}

/**
 * Starts a session for the user, ending the one the browser was already holding (if any) so
 * tokens don't accumulate or get reused.
 */
export function startSession(db: Db, userId: string, previousToken?: string) {
  if (previousToken) deleteSession(db, previousToken);
  return createSession(db, userId);
}
