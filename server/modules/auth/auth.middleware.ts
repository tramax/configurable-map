import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { SESSION_COOKIE } from "./cookie";
import { getSessionUser } from "./sessions";
import type { Db } from "@shared/db/client";
import type { AppEnv } from "@shared/types";

/** Resolves the session cookie (if any) into `c.var.user`. Never rejects; use requireAuth for that. */
export const loadSession = (db: Db) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    c.set("user", token ? getSessionUser(db, token) : null);
    await next();
  });

/** Guards a route: responds 401 unless loadSession found a user. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.var.user) return c.json({ error: "Not signed in" }, 401);
  await next();
});
