import { requireAuth } from "@modules/auth";
import type { Db } from "@shared/db/client";
import { createRouter } from "@shared/openapi";
import { toDto } from "./configurations.dto";
import {
  createConfigRoute,
  defaultRoute,
  listRoute,
  publishRoute,
  unpublishRoute,
} from "./configurations.openapi";
import { configSchema } from "./configurations.schemas";
import { createConfigurationService } from "./configurations.service";

/*
 * Extending this module: declare the route in configurations.openapi.ts, put the query in
 * configurations.service.ts, and register the handler with `router.openapi(...)` below. Place it
 * above `router.use("*", requireAuth)` only if it must be public.
 */
export function configurationRoutes(db: Db) {
  const router = createRouter();
  const service = createConfigurationService(db);

  // Public. Registered before requireAuth on purpose: the app asks for it on first load, before
  // anyone has signed in. Everything registered after the requireAuth line below needs a session,
  // so a route added later is protected unless it is deliberately put above it.
  router.openapi(defaultRoute, (context) => {
    const { datasetId } = context.req.valid("query");
    const row = service.findDefault(datasetId);
    if (!row) return context.json({ error: "No default configuration for this dataset" }, 404);

    // The database stores the configuration as unchecked JSON, and a seeded or hand-edited row
    // never went through the API's validation. Check it here so the client can trust what it gets.
    if (!configSchema.safeParse(row.config).success) {
      console.error(`The default configuration of "${datasetId}" is not a valid configuration`);
      return context.json({ error: "The default configuration is invalid" }, 500);
    }
    return context.json(toDto(row, null, null), 200);
  });

  router.use("*", requireAuth);

  router.openapi(listRoute, (context) => {
    const { datasetId } = context.req.valid("query");
    const user = context.var.user!;
    const rows = service.listVisibleTo(user.id, datasetId);
    return context.json(rows.map(({ row, author }) => toDto(row, author, user.id)), 200);
  });

  router.openapi(createConfigRoute, (context) => {
    const user = context.var.user!;
    const row = service.create(user.id, context.req.valid("json"));
    return context.json(toDto(row, user.username, user.id), 201);
  });

  router.openapi(publishRoute, (context) => {
    const { id } = context.req.valid("param");
    const user = context.var.user!;
    const row = service.setPublished(id, user.id, true);
    if (!row) return context.json({ error: "Configuration not found" }, 404);
    return context.json(toDto(row, user.username, user.id), 200);
  });

  router.openapi(unpublishRoute, (context) => {
    const { id } = context.req.valid("param");
    const user = context.var.user!;
    const row = service.setPublished(id, user.id, false);
    if (!row) return context.json({ error: "Configuration not found" }, 404);
    return context.json(toDto(row, user.username, user.id), 200);
  });

  return router;
}
