import { randomUUID } from "node:crypto";
import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { requireAuth } from "@modules/auth";
import type { Db } from "@shared/db/client";
import { configurations, users, type ConfigurationRecord } from "@shared/db/schema";
import { COOKIE_AUTH, createRouter, errorResponse, requireJson } from "@shared/openapi";
import {
  configSchema,
  createBodySchema,
  idParamSchema,
  listQuerySchema,
  savedConfigurationSchema,
} from "./configurations.schemas";

/**
 * What the API returns. The owner's id is never sent; a published configuration carries its
 * author's username instead, and `mine` tells the client whether the viewer may manage it.
 */
const toDto = (
  r: ConfigurationRecord,
  author: string | null,
  viewerId: string | null,
): z.infer<typeof savedConfigurationSchema> => ({
  id: r.id,
  datasetId: r.datasetId,
  name: r.name,
  visibility: r.visibility,
  isDefault: r.isDefault,
  author,
  mine: viewerId !== null && r.ownerId === viewerId,
  createdAt: r.createdAt.toISOString(),
  publishedAt: r.publishedAt?.toISOString() ?? null,
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
    "The configurations the user may open: platform (system) ones, ones other users have published, and their own (private or published). Newest first.",
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

const publishRoute = createRoute({
  method: "post",
  path: "/{id}/publish",
  tags: ["Configurations"],
  summary: "Publish a configuration",
  description:
    "Shares one of the user's own configurations: every signed-in user can then see and open it, " +
    "with the owner's username as its author. Publishing a published configuration changes nothing.",
  security,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The configuration, now public",
      content: { "application/json": { schema: savedConfigurationSchema } },
    },
    401: errorResponse("Not signed in"),
    404: errorResponse("No such configuration, or it is not the user's own"),
  },
});

const unpublishRoute = createRoute({
  method: "post",
  path: "/{id}/unpublish",
  tags: ["Configurations"],
  summary: "Stop sharing a configuration",
  description:
    "Makes one of the user's own published configurations private again. It disappears from other users' lists; " +
    "copies they saved from it are theirs and stay.",
  security,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The configuration, now private",
      content: { "application/json": { schema: savedConfigurationSchema } },
    },
    401: errorResponse("Not signed in"),
    404: errorResponse("No such configuration, or it is not the user's own"),
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
    return c.json(toDto(row, null, null), 200);
  });

  router.use("*", requireAuth);

  router.openapi(listRoute, (c) => {
    const { datasetId } = c.req.valid("query");
    const user = c.var.user!;

    const rows = db
      .select({ row: configurations, author: users.username })
      .from(configurations)
      .leftJoin(users, eq(users.id, configurations.ownerId))
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
    return c.json(rows.map(({ row, author }) => toDto(row, author, user.id)), 200);
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
    return c.json(toDto(row, c.var.user!.username, c.var.user!.id), 201);
  });

  // Publishing is a state change on the owner's own row. The ownership check is part of the UPDATE,
  // so there is no window between checking and writing, and a row that is someone else's looks
  // exactly like one that does not exist (404), so ids of private configurations cannot be probed.
  const setPublished = (id: string, ownerId: string, published: boolean) =>
    db
      .update(configurations)
      .set({
        visibility: published ? "public" : "private",
        // Publishing again keeps the original date; unpublishing clears it (the table requires both to agree).
        publishedAt: published ? sql`coalesce(${configurations.publishedAt}, ${Date.now()})` : null,
      })
      .where(and(eq(configurations.id, id), eq(configurations.ownerId, ownerId)))
      .returning()
      .get();

  router.openapi(publishRoute, (c) => {
    const { id } = c.req.valid("param");
    const user = c.var.user!;
    const row = setPublished(id, user.id, true);
    if (!row) return c.json({ error: "Configuration not found" }, 404);
    return c.json(toDto(row, user.username, user.id), 200);
  });

  router.openapi(unpublishRoute, (c) => {
    const { id } = c.req.valid("param");
    const user = c.var.user!;
    const row = setPublished(id, user.id, false);
    if (!row) return c.json({ error: "Configuration not found" }, 404);
    return c.json(toDto(row, user.username, user.id), 200);
  });

  return router;
}
