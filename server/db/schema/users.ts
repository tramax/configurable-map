import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Users who can sign in. There is no self-registration: accounts are created by the seed script.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // uuid
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(), // "<salt>:<scrypt hash>", both hex
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
