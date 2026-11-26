import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { hashPassword } from "@modules/auth";
import { createDb } from "./client";
import { configurationSchema, type Configuration } from "@contract/configuration.schema";
import { configurations, users } from "./schema";

// Demo accounts: there is no registration, these are the only users.
const DEMO_USERS = [
  { username: "alice", password: "alice-demo" },
  { username: "bob", password: "bob-demo" },
  { username: "carol", password: "carol-demo" },
];

// The predefined configuration each dataset opens with: system-owned, and the dataset's default.
// Add an entry here to give another dataset its own default.
const DEFAULT_CONFIGURATIONS: Array<{
  id: string;
  datasetId: string;
  name: string;
  config: Configuration;
}> = [
  {
    id: "default-landscape-trees",
    datasetId: "landscape-trees",
    name: "Default",
    config: {
      symbolConfig: {
        color: { field: "Leaf_Area", stops: [{ value: 10, color: "#ffffff" }, { value: 40000, color: "#00fd00" }] },
        size: { field: "Leaf_Bmass", stops: [{ value: 0, size: 5 }, { value: 700, size: 40 }] },
      },
      tableConfig: { columns: ["Leaf_Area", "Leaf_Bmass"] },
    },
  },
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

for (const { id, datasetId, name, config } of DEFAULT_CONFIGURATIONS) {
  // The database does not check the shape of the JSON, so fail here rather than serve a broken default.
  configurationSchema.parse(config);
  // Re-running the seed leaves an existing default alone, so changes made to it in the database survive.
  const { changes } = db
    .insert(configurations)
    .values({ id, datasetId, name, ownerId: null, visibility: "system", isDefault: true, config })
    .onConflictDoNothing()
    .run();
  console.log(changes ? `seeded default configuration for "${datasetId}"` : `kept default configuration for "${datasetId}"`);
}
