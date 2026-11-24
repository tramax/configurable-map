import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Db } from "@shared/db/client";
import { createRouter } from "@shared/openapi";
import { loginRoute, logoutRoute, meRoute } from "./auth.openapi";
import { authenticate, startSession } from "./auth.service";
import { SESSION_COOKIE, sessionCookieOptions } from "./cookie";
import { deleteSession } from "./sessions";

export function authRoutes(db: Db, opts: { secureCookies: boolean }) {
  const cookieOptions = sessionCookieOptions(opts.secureCookies);
  const router = createRouter();

  router.openapi(meRoute, (context) => context.json(context.var.user!, 200));

  router.openapi(loginRoute, (context) => {
    const { username, password } = context.req.valid("json");

    const user = authenticate(db, username, password);
    if (!user) return context.json({ error: "Invalid username or password" }, 401);

    const { token, expiresAt } = startSession(db, user.id, getCookie(context, SESSION_COOKIE));
    setCookie(context, SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt });
    return context.json(user, 200);
  });

  router.openapi(logoutRoute, (context) => {
    const token = getCookie(context, SESSION_COOKIE);
    if (token) deleteSession(db, token);
    deleteCookie(context, SESSION_COOKIE, cookieOptions);
    return context.body(null, 204);
  });

  return router;
}
