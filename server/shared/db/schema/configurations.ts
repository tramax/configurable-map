import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
// Type-only import: erased at runtime, so the server never loads @arcgis/core.
import type { Configuration } from "@src/configSchema";
import { users } from "./users";

export const VISIBILITIES = ["system", "private", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/**
 * Display configurations for a dataset.
 *  - system:  predefined by the platform (owner is NULL); exactly one per dataset is the default
 *  - private: a user's saved configuration, visible only to its owner
 *  - public:  a private configuration its owner has published for everyone
 *
 * HOW TO EXTEND
 *  - Sharing with chosen users or groups: add a `shared_with` join table (configuration_id,
 *    user_id) and a `shared` visibility. The list query in configurations.routes.ts already
 *    filters by visibility/owner, so it gains one more OR branch.
 *  - Sharing by link: add a `share_token` column, and a public GET route that looks it up.
 *  - Update/delete: add PATCH/DELETE routes that reuse the ownership-in-the-WHERE pattern of
 *    `setPublished`; add `updatedAt` here.
 *  - More datasets: nothing to change here; rows are already keyed by `datasetId`.
 *  - Per-user default: add a `user_defaults` table (user_id, dataset_id, configuration_id).
 */
export const configurations = sqliteTable(
  "configurations",
  {
    id: text("id").primaryKey(), // uuid
    datasetId: text("dataset_id").notNull(), // e.g. "landscape-trees"
    name: text("name").notNull(),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "cascade" }),
    visibility: text("visibility", { enum: VISIBILITIES }).notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    // JSON blob validated against the Configuration schema at the API boundary.
    config: text("config", { mode: "json" }).$type<Configuration>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    check("configurations_name_length", sql`length(${t.name}) BETWEEN 1 AND 100`),
    // System configs have no owner; user configs always have one.
    check(
      "configurations_owner_matches_visibility",
      sql`(${t.visibility} = 'system') = (${t.ownerId} IS NULL)`,
    ),
    // Only system configs can be the default.
    check(
      "configurations_default_is_system",
      sql`${t.isDefault} = 0 OR ${t.visibility} = 'system'`,
    ),
    // Published state and timestamp must agree.
    check(
      "configurations_published_at_matches_visibility",
      sql`(${t.visibility} = 'public') = (${t.publishedAt} IS NOT NULL)`,
    ),
    // At most one default per dataset.
    uniqueIndex("ux_configurations_default")
      .on(t.datasetId)
      .where(sql`${t.isDefault} = 1`),
    // Serves "configs for this dataset visible to this user".
    index("ix_configurations_dataset").on(t.datasetId, t.visibility, t.ownerId),
  ],
);

export type ConfigurationRecord = typeof configurations.$inferSelect;
export type NewConfigurationRecord = typeof configurations.$inferInsert;
