import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { SESSION_COOKIE } from "./cookie";
import { getSessionUser } from "./sessions";
import type { Db } from "@shared/db/client";
import type { AppEnv } from "@shared/types";

/** Resolves the session cookie (if any) into `context.var.user`. Never rejects; use requireAuth for that. */
export const loadSession = (db: Db) =>
  createMiddleware<AppEnv>(async (context, next) => {
    const token = getCookie(context, SESSION_COOKIE);
    context.set("user", token ? getSessionUser(db, token) : null);
    await next();
  });

/** Guards a route: responds 401 unless loadSession found a user. */
export const requireAuth = createMiddleware<AppEnv>(async (context, next) => {
  if (!context.var.user) return context.json({ error: "Not signed in" }, 401);
  await next();
});
