import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { hashPassword } from "@modules/auth";
import { createDb } from "./client";
import { users } from "./schema";

// Demo accounts: there is no registration, these are the only users.
const DEMO_USERS = [
  { username: "alice", password: "alice-demo" },
  { username: "bob", password: "bob-demo" },
  { username: "carol", password: "carol-demo" },
];

const DB_PATH = process.env.DB_PATH ?? "./data/app.db";

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = createDb(DB_PATH);
migrate(db, { migrationsFolder: "./server/shared/db/migrations" });

for (const { username, password } of DEMO_USERS) {
  const passwordHash = hashPassword(password);
  // Re-running the seed resets the password but keeps the user's id (and so their configurations).
  db.insert(users)
    .values({ id: randomUUID(), username, passwordHash })
    .onConflictDoUpdate({ target: users.username, set: { passwordHash } })
    .run();
  console.log(`seeded user "${username}"`);
}
