import type { z } from "@hono/zod-openapi";
import type { ConfigurationRecord } from "@shared/db/schema";
import type { savedConfigurationSchema } from "./configurations.schemas";

/**
 * What the API returns. The owner's id is never sent; a published configuration carries its
 * author's username instead, and `mine` tells the client whether the viewer may manage it.
 */
export const toDto = (
  record: ConfigurationRecord,
  author: string | null,
  viewerId: string | null,
): z.infer<typeof savedConfigurationSchema> => ({
  id: record.id,
  datasetId: record.datasetId,
  name: record.name,
  visibility: record.visibility,
  isDefault: record.isDefault,
  author,
  mine: viewerId !== null && record.ownerId === viewerId,
  createdAt: record.createdAt.toISOString(),
  config: record.config,
});
