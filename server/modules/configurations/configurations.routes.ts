import { randomUUID } from "node:crypto";
import { and, desc, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { requireAuth } from "@modules/auth";
import type { Db } from "@shared/db/client";
import { configurations, type ConfigurationRecord } from "@shared/db/schema";
import type { AppEnv } from "@shared/types";
import { parseConfiguration, parseDatasetId, parseName } from "./validate";

/** What the API returns: the record without the owner (clients only ever see what they may use). */
const toDto = (r: ConfigurationRecord) => ({
  id: r.id,
  datasetId: r.datasetId,
  name: r.name,
  visibility: r.visibility,
  isDefault: r.isDefault,
  createdAt: r.createdAt,
  config: r.config,
});

export function configurationRoutes(db: Db) {
  const router = new Hono<AppEnv>();
  router.use("*", requireAuth);

  /** Configurations of a dataset the user may open: platform ones, published ones, and their own. */
  router.get("/", (c) => {
    const dataset = parseDatasetId(c.req.query("datasetId"));
    if (!dataset.ok) return c.json({ error: dataset.error }, 400);
    const user = c.var.user!;

    const rows = db
      .select()
      .from(configurations)
      .where(
        and(
          eq(configurations.datasetId, dataset.value),
          or(
            eq(configurations.visibility, "system"),
            eq(configurations.visibility, "public"),
            eq(configurations.ownerId, user.id),
          ),
        ),
      )
      .orderBy(desc(configurations.createdAt))
      .all();
    return c.json(rows.map(toDto));
  });

  /** Saves a new private configuration for the signed-in user. */
  router.post("/", async (c) => {
    // Requiring JSON means a cross-site HTML form can't trigger this request.
    if (!c.req.header("content-type")?.includes("application/json")) {
      return c.json({ error: "Expected JSON" }, 415);
    }
    const body = await c.req.json().catch(() => null);
    if (typeof body !== "object" || body === null) return c.json({ error: "Expected a JSON object" }, 400);

    const dataset = parseDatasetId(body.datasetId);
    if (!dataset.ok) return c.json({ error: dataset.error }, 400);
    const name = parseName(body.name);
    if (!name.ok) return c.json({ error: name.error }, 400);
    const config = parseConfiguration(body.config);
    if (!config.ok) return c.json({ error: config.error }, 400);

    const row = db
      .insert(configurations)
      .values({
        id: randomUUID(),
        datasetId: dataset.value,
        name: name.value,
        ownerId: c.var.user!.id,
        visibility: "private",
        config: config.value,
      })
      .returning()
      .get();
    return c.json(toDto(row), 201);
  });

  return router;
}
