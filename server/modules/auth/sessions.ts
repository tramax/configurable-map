import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Db } from "@shared/db/client";
import { sessions, users } from "@shared/db/schema";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a session and returns the raw token (only its hash is stored). */
export function createSession(db: Db, userId: string): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt }).run();
  // Opportunistic sweep so expired rows don't pile up.
  db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
  return { token, expiresAt };
}

export function getSessionUser(db: Db, token: string): { id: string; username: string } | null {
  const row = db
    .select({ id: users.id, username: users.username })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .get();
  return row ?? null;
}

export function deleteSession(db: Db, token: string): void {
  db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token))).run();
}
