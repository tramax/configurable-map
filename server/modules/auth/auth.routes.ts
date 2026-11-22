import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { SESSION_COOKIE, sessionCookieOptions } from "./cookie";
import { hashPassword, verifyPassword } from "./password";
import { createSession, deleteSession } from "./sessions";
import type { Db } from "@shared/db/client";
import { users } from "@shared/db/schema";
import { requireAuth } from "./auth.middleware";
import type { AppEnv } from "@shared/types";

// Compared against when the username doesn't exist, so response time doesn't reveal valid usernames.
const DUMMY_HASH = hashPassword("dummy-password");

export function authRoutes(db: Db, opts: { secureCookies: boolean }) {
  const cookieOptions = sessionCookieOptions(opts.secureCookies);
  const router = new Hono<AppEnv>();

  router.get("/me", requireAuth, (c) => c.json(c.var.user));

  router.post("/login", async (c) => {
    // Requiring JSON means a cross-site HTML form can't trigger this request.
    if (!c.req.header("content-type")?.includes("application/json")) {
      return c.json({ error: "Expected JSON" }, 415);
    }
    const body = await c.req.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!username || !password) return c.json({ error: "Username and password required" }, 400);

    const row = db.select().from(users).where(eq(users.username, username)).get();
    const ok = verifyPassword(password, row?.passwordHash ?? DUMMY_HASH);
    if (!row || !ok) return c.json({ error: "Invalid username or password" }, 401);

    // Drop any session the browser was already holding so tokens don't accumulate or get reused.
    const previous = getCookie(c, SESSION_COOKIE);
    if (previous) deleteSession(db, previous);

    const { token, expiresAt } = createSession(db, row.id);
    setCookie(c, SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt });
    return c.json({ id: row.id, username: row.username });
  });

  router.post("/logout", (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) deleteSession(db, token);
    deleteCookie(c, SESSION_COOKIE, cookieOptions);
    return c.body(null, 204);
  });

  return router;
}
