import { randomUUID } from "node:crypto";
import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, or } from "drizzle-orm";
import { requireAuth } from "@modules/auth";
import type { Db } from "@shared/db/client";
import { configurations, type ConfigurationRecord } from "@shared/db/schema";
import { COOKIE_AUTH, createRouter, errorResponse, requireJson } from "@shared/openapi";
import { createBodySchema, listQuerySchema, savedConfigurationSchema } from "./configurations.schemas";

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
