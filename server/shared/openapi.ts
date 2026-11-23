import { OpenAPIHono, z } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./types";

/** Body of every error response. */
export const errorSchema = z.object({ error: z.string() }).openapi("Error");

/** Documents an error response of a route. */
export const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorSchema } },
});

/** Name of the session cookie security scheme registered in app.ts; routes that need it list it. */
export const COOKIE_AUTH = "cookieAuth";

/**
 * Every module builds its router with this, so that a request failing its route's schema is
 * answered with `400 { error }` like every other error, naming the first problem found.
 */
export const createRouter = () =>
  new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (result.success) return;
      const issue = result.error.issues[0];
      const where = issue.path.join(".");
      return c.json({ error: where ? `${where}: ${issue.message}` : issue.message }, 400);
    },
  });

/**
 * Rejects a request whose body isn't JSON with 415. Put it on every route with a body: a
 * cross-site HTML form can't send JSON, so this keeps such a form from triggering the route.
 */
export const requireJson = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.req.header("content-type")?.includes("application/json")) {
    return c.json({ error: "Expected JSON" }, 415);
  }
  await next();
});
