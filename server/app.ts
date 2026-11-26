import { swaggerUI } from "@hono/swagger-ui";
import { HTTPException } from "hono/http-exception";
import { authRoutes, loadSession, SESSION_COOKIE } from "@modules/auth";
import { configurationRoutes } from "@modules/configurations";
import type { Db } from "@shared/db/client";
import { COOKIE_AUTH, createRouter } from "@shared/openapi";

/**
 * Composes the app: shared middleware first, then one router per feature module under /api.
 * To add a feature, create server/modules/<feature>/ and mount its routes here.
 */
export function createApp(db: Db, opts: { secureCookies?: boolean } = {}) {
  const secureCookies = opts.secureCookies ?? false;
  const app = createRouter();

  app.use("/api/*", loadSession(db));

  app.route("/api/auth", authRoutes(db, { secureCookies }));
  app.route("/api/configurations", configurationRoutes(db));

  // API documentation, generated from the routes' schemas: the spec as JSON, and Swagger UI on it.
  app.openAPIRegistry.registerComponent("securitySchemes", COOKIE_AUTH, {
    type: "apiKey",
    in: "cookie",
    name: SESSION_COOKIE,
    description: "Set by POST /api/auth/login.",
  });
  app.doc("/api/openapi.json", {
    openapi: "3.0.3",
    info: {
      title: "Configurable Trees API",
      version: "1.0.0",
      description: "Sign-in and the saved display configurations of the Configurable Trees map.",
    },
  });
  app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }));

  app.onError((err, context) => {
    // Errors raised on purpose with a status, such as malformed JSON (400), keep that status.
    if (err instanceof HTTPException) return context.json({ error: err.message }, err.status);
    console.error(err);
    return context.json({ error: "Internal server error" }, 500);
  });

  return app;
}
