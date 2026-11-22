import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createApp } from "./app";
import { createDb } from "@shared/db/client";

const DB_PATH = process.env.DB_PATH ?? "./data/app.db";
const PORT = Number(process.env.PORT ?? 3001);

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = createDb(DB_PATH);
migrate(db, { migrationsFolder: "./server/shared/db/migrations" });

const app = createApp(db, { secureCookies: process.env.NODE_ENV === "production" });

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
