import { z } from "@hono/zod-openapi";
import { configurationSchema } from "@src/configSchema";
import { VISIBILITIES } from "@shared/db/schema";

const datasetId = z.string().min(1).max(100).openapi({ example: "landscape-trees" });

/** The configuration itself, as shared with the frontend. Named so the docs define it once. */
export const configSchema = configurationSchema.openapi("Configuration");

export const listQuerySchema = z.object({
  datasetId: datasetId.openapi({ description: "Dataset the configurations are for" }),
});

export const createBodySchema = z
  .object({
    datasetId,
    name: z.string().trim().min(1).max(100).openapi({ example: "Tall trees" }),
    config: configSchema,
  })
  .openapi("CreateConfigurationRequest");

export const savedConfigurationSchema = z
  .object({
    id: z.string().openapi({ description: "UUID" }),
    datasetId,
    name: z.string(),
    visibility: z.enum(VISIBILITIES).openapi({
      description: "`private` configurations are visible to their owner only",
    }),
    isDefault: z.boolean(),
    createdAt: z.string().openapi({ format: "date-time" }),
    config: configSchema,
  })
  .openapi("SavedConfiguration");
