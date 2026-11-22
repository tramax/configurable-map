import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * Server-side login sessions. The browser holds a random token in an HttpOnly cookie;
 * only the SHA-256 hash of that token is stored, so a leaked DB can't be replayed.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("ix_sessions_user").on(t.userId),
    index("ix_sessions_expires").on(t.expiresAt), // for sweeping expired rows
  ],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
