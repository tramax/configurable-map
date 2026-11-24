import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createApp } from "../app";
import { hashPassword } from "@modules/auth";
import { createDb } from "@shared/db/client";
import { configurations, users } from "@shared/db/schema";
import type { Configuration } from "@contract/configuration.schema";

export const DATASET = "landscape-trees";

export const VALID_CONFIG: Configuration = {
  symbolConfig: {
    color: { field: "Leaf_Area", stops: [{ value: 0, color: "#ffffff" }, { value: 100, color: "#00ff00" }] },
    size: { field: "Leaf_Bmass", stops: [{ value: 0, size: 5 }, { value: 700, size: 40 }] },
  },
  tableConfig: { columns: ["Leaf_Area", "Leaf_Bmass"] },
};

/** A fresh in-memory database with the real migrations, two users and (optionally) the default. */
export function createTestApp({ withDefault = true }: { withDefault?: boolean } = {}) {
  const db = createDb(":memory:");
  migrate(db, { migrationsFolder: "./server/shared/db/migrations" });

  for (const username of ["alice", "bob"]) {
    db.insert(users).values({ id: randomUUID(), username, passwordHash: hashPassword(`${username}-pw`) }).run();
  }
  if (withDefault) {
    db.insert(configurations)
      .values({
        id: "default",
        datasetId: DATASET,
        name: "Default",
        ownerId: null,
        visibility: "system",
        isDefault: true,
        config: VALID_CONFIG,
      })
      .run();
  }

  const app = createApp(db);

  /** Signs in and returns a small client that sends the session cookie with every call. */
  async function login(username: string) {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: `${username}-pw` }),
    });
    if (res.status !== 200) throw new Error(`login failed for ${username}: ${res.status}`);
    const cookie = res.headers.get("set-cookie")!.split(";")[0];

    const call = async (method: string, path: string, body?: unknown) =>
      app.request(path, {
        method,
        headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    return {
      get: (path: string) => call("GET", path),
      post: (path: string, body?: unknown) => call("POST", path, body),
    };
  }

  return { app, db, login };
}
