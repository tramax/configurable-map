import { randomUUID } from "node:crypto";
import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, or } from "drizzle-orm";
import { requireAuth } from "@modules/auth";
import type { Db } from "@shared/db/client";
import { configurations, type ConfigurationRecord } from "@shared/db/schema";
import { COOKIE_AUTH, createRouter, errorResponse, requireJson } from "@shared/openapi";
import {
  configSchema,
  createBodySchema,
  listQuerySchema,
  savedConfigurationSchema,
} from "./configurations.schemas";

/** What the API returns: the record without the owner (clients only ever see what they may use). */
const toDto = (r: ConfigurationRecord): z.infer<typeof savedConfigurationSchema> => ({
  id: r.id,
  datasetId: r.datasetId,
  name: r.name,
  visibility: r.visibility,
  isDefault: r.isDefault,
  createdAt: r.createdAt.toISOString(),
  config: r.config,
});

const security = [{ [COOKIE_AUTH]: [] }];

const defaultRoute = createRoute({
  method: "get",
  path: "/default",
  tags: ["Configurations"],
  summary: "The default configuration of a dataset",
  description:
    "The predefined configuration the app opens with. Public: it is needed before anyone signs in, " +
    "and only ever returns the platform's own (system) configuration.",
  request: { query: listQuerySchema },
  responses: {
    200: {
      description: "The default configuration",
      content: { "application/json": { schema: savedConfigurationSchema } },
    },
    400: errorResponse("`datasetId` is missing"),
    404: errorResponse("The dataset has no default configuration"),
    500: errorResponse("The stored default is not a valid configuration"),
  },
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Configurations"],
  summary: "List the configurations of a dataset",
  description:
    "The configurations the user may open: platform (system) ones, published ones, and their own. Newest first.",
  security,
  request: { query: listQuerySchema },
  responses: {
    200: {
      description: "The configurations",
      content: { "application/json": { schema: z.array(savedConfigurationSchema) } },
    },
    400: errorResponse("`datasetId` is missing"),
    401: errorResponse("Not signed in"),
  },
});

const createConfigRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Configurations"],
  summary: "Save a configuration",
  description: "Saves a new private configuration owned by the signed-in user.",
  security,
  middleware: [requireJson] as const,
  request: {
    body: { required: true, content: { "application/json": { schema: createBodySchema } } },
  },
  responses: {
    201: {
      description: "The saved configuration",
      content: { "application/json": { schema: savedConfigurationSchema } },
    },
    400: errorResponse("The request is invalid; the message names the first problem"),
    401: errorResponse("Not signed in"),
    415: errorResponse("Body is not JSON"),
  },
});

export function configurationRoutes(db: Db) {
  const router = createRouter();

  // Public. Registered before requireAuth on purpose: the app asks for it on first load, before
  // anyone has signed in. Everything registered after the requireAuth line below needs a session,
  // so a route added later is protected unless it is deliberately put above it.
  router.openapi(defaultRoute, (c) => {
    const { datasetId } = c.req.valid("query");
    // The schema allows at most one default per dataset, and only system rows can be one.
    const row = db
      .select()
      .from(configurations)
      .where(and(eq(configurations.datasetId, datasetId), eq(configurations.isDefault, true)))
      .get();
    if (!row) return c.json({ error: "No default configuration for this dataset" }, 404);

    // The database stores the configuration as unchecked JSON, and a seeded or hand-edited row
    // never went through the API's validation. Check it here so the client can trust what it gets.
    if (!configSchema.safeParse(row.config).success) {
      console.error(`The default configuration of "${datasetId}" is not a valid configuration`);
      return c.json({ error: "The default configuration is invalid" }, 500);
    }
    return c.json(toDto(row), 200);
  });

  router.use("*", requireAuth);

  router.openapi(listRoute, (c) => {
    const { datasetId } = c.req.valid("query");
    const user = c.var.user!;

    const rows = db
      .select()
      .from(configurations)
      .where(
        and(
          eq(configurations.datasetId, datasetId),
          or(
            eq(configurations.visibility, "system"),
            eq(configurations.visibility, "public"),
            eq(configurations.ownerId, user.id),
          ),
        ),
      )
      .orderBy(desc(configurations.createdAt))
      .all();
    return c.json(rows.map(toDto), 200);
  });

  router.openapi(createConfigRoute, (c) => {
    const { datasetId, name, config } = c.req.valid("json");

    const row = db
      .insert(configurations)
      .values({
        id: randomUUID(),
        datasetId,
        name,
        ownerId: c.var.user!.id,
        visibility: "private",
        config,
      })
      .returning()
      .get();
    return c.json(toDto(row), 201);
  });

  return router;
}
