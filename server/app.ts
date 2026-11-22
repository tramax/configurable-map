import { Hono } from "hono";
import { authRoutes, loadSession } from "@modules/auth";
import type { Db } from "@shared/db/client";
import type { AppEnv } from "@shared/types";

/**
 * Composes the app: shared middleware first, then one router per feature module under /api.
 * To add a feature, create server/modules/<feature>/ and mount its routes here.
 */
export function createApp(db: Db, opts: { secureCookies?: boolean } = {}) {
  const secureCookies = opts.secureCookies ?? false;
  const app = new Hono<AppEnv>();

  app.use("/api/*", loadSession(db));

  app.route("/api/auth", authRoutes(db, { secureCookies }));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
