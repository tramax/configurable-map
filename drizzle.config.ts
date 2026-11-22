import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./server/shared/db/schema/index.ts",
  out: "./server/shared/db/migrations",
  dbCredentials: { url: "./data/app.db" },
});
