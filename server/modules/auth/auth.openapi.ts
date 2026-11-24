import { createRoute } from "@hono/zod-openapi";
import { COOKIE_AUTH, errorResponse, requireJson } from "@shared/openapi";
import { requireAuth } from "./auth.middleware";
import { loginBodySchema, userSchema } from "./auth.schemas";

/** OpenAPI route declarations. The handlers live in auth.routes.ts. */

export const meRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Auth"],
  summary: "Get the signed-in user",
  security: [{ [COOKIE_AUTH]: [] }],
  // Per route rather than `router.use`: /login and /logout must stay reachable when signed out.
  middleware: [requireAuth] as const,
  responses: {
    200: { description: "The signed-in user", content: { "application/json": { schema: userSchema } } },
    401: errorResponse("Not signed in"),
  },
});

export const loginRoute = createRoute({
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

export const logoutRoute = createRoute({
  method: "post",
  path: "/logout",
  tags: ["Auth"],
  summary: "Sign out",
  description: "Ends the session and clears the cookie. Succeeds even when not signed in.",
  responses: { 204: { description: "Signed out" } },
});
