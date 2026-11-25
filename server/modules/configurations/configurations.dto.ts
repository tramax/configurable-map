import type { SavedConfiguration } from "@contract/configuration.schema";
import type { ConfigurationRecord } from "@shared/db/schema";

/**
 * What the API returns. The owner's id is never sent; a published configuration carries its
 * author's username instead, and `mine` tells the client whether the viewer may manage it.
 */
export const toDto = (
  record: ConfigurationRecord,
  author: string | null,
  viewerId: string | null,
): SavedConfiguration => ({
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
