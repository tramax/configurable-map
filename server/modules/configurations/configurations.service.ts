import { randomUUID } from "node:crypto";
import { and, desc, eq, or } from "drizzle-orm";
import type { Db } from "@shared/db/client";
import { configurations, users, type ConfigurationRecord } from "@shared/db/schema";

export type NewConfiguration = Pick<ConfigurationRecord, "datasetId" | "name" | "config">;

/** Database access for configurations. No HTTP types in here; the handlers shape the responses. */
export function createConfigurationService(db: Db) {
  return {
    /** The dataset's default. The schema allows at most one per dataset, and only system rows can be one. */
    findDefault(datasetId: string) {
      return db
        .select()
        .from(configurations)
        .where(and(eq(configurations.datasetId, datasetId), eq(configurations.isDefault, true)))
        .get();
    },

    /** Everything the user may open: system rows, published rows, and their own. Newest first. */
    listVisibleTo(userId: string, datasetId: string) {
      return db
        .select({ row: configurations, author: users.username })
        .from(configurations)
        .leftJoin(users, eq(users.id, configurations.ownerId))
        .where(
          and(
            eq(configurations.datasetId, datasetId),
            or(
              eq(configurations.visibility, "system"),
              eq(configurations.visibility, "public"),
              eq(configurations.ownerId, userId),
            ),
          ),
        )
        .orderBy(desc(configurations.createdAt))
        .all();
    },

    /** Saves a new private configuration owned by `ownerId`. */
    create(ownerId: string, { datasetId, name, config }: NewConfiguration) {
      return db
        .insert(configurations)
        .values({ id: randomUUID(), datasetId, name, ownerId, visibility: "private", config })
        .returning()
        .get();
    },

    /**
     * Publishing is a state change on the owner's own row. The ownership check is part of the UPDATE,
     * so there is no window between checking and writing, and a row that is someone else's looks
     * exactly like one that does not exist (undefined, so a 404), so ids of private configurations
     * cannot be probed. Update and delete (not implemented yet) should follow the same rule.
     */
    setPublished(id: string, ownerId: string, published: boolean) {
      return db
        .update(configurations)
        .set({ visibility: published ? "public" : "private" })
        .where(and(eq(configurations.id, id), eq(configurations.ownerId, ownerId)))
        .returning()
        .get();
    },
  };
}
