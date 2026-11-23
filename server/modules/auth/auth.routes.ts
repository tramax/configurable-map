import { createRoute } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { SESSION_COOKIE, sessionCookieOptions } from "./cookie";
import { hashPassword, verifyPassword } from "./password";
import { createSession, deleteSession } from "./sessions";
import type { Db } from "@shared/db/client";
import { users } from "@shared/db/schema";
import { COOKIE_AUTH, createRouter, errorResponse, requireJson } from "@shared/openapi";
import { requireAuth } from "./auth.middleware";
import { loginBodySchema, userSchema } from "./auth.schemas";

// Compared against when the username doesn't exist, so response time doesn't reveal valid usernames.
const DUMMY_HASH = hashPassword("dummy-password");

const meRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Auth"],
  summary: "Get the signed-in user",
  security: [{ [COOKIE_AUTH]: [] }],
  middleware: [requireAuth] as const,
  responses: {
    200: { description: "The signed-in user", content: { "application/json": { schema: userSchema } } },
    401: errorResponse("Not signed in"),
  },
});

const loginRoute = createRoute({
  method: "post",
  path: "/login",
  tags: ["Auth"],
  summary: "Sign in",
  description: "Sets the session cookie. Any session the browser already held is replaced.",
  middleware: [requireJson] as const,
  request: {
    body: { required: true, content: { "application/json": { schema: loginBodySchema } } },
  },
  responses: {
    200: { description: "Signed in", content: { "application/json": { schema: userSchema } } },
    400: errorResponse("Username or password missing"),
    401: errorResponse("Invalid username or password"),
    415: errorResponse("Body is not JSON"),
  },
});

const logoutRoute = createRoute({
  method: "post",
  path: "/logout",
  tags: ["Auth"],
  summary: "Sign out",
  description: "Ends the session and clears the cookie. Succeeds even when not signed in.",
  responses: { 204: { description: "Signed out" } },
});

export function authRoutes(db: Db, opts: { secureCookies: boolean }) {
  const cookieOptions = sessionCookieOptions(opts.secureCookies);
  const router = createRouter();

  router.openapi(meRoute, (context) => context.json(context.var.user!, 200));

  router.openapi(loginRoute, (context) => {
    const { username, password } = context.req.valid("json");

    const row = db.select().from(users).where(eq(users.username, username)).get();
    const ok = verifyPassword(password, row?.passwordHash ?? DUMMY_HASH);
    if (!row || !ok) return context.json({ error: "Invalid username or password" }, 401);

    // Drop any session the browser was already holding so tokens don't accumulate or get reused.
    const previous = getCookie(context, SESSION_COOKIE);
    if (previous) deleteSession(db, previous);

    const { token, expiresAt } = createSession(db, row.id);
    setCookie(context, SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt });
    return context.json({ id: row.id, username: row.username }, 200);
  });

  router.openapi(logoutRoute, (context) => {
    const token = getCookie(context, SESSION_COOKIE);
    if (token) deleteSession(db, token);
    deleteCookie(context, SESSION_COOKIE, cookieOptions);
    return context.body(null, 204);
  });

  return router;
}
