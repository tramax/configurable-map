import { z } from "@hono/zod-openapi";
import { configurationSchema } from "@contract/configuration.schema";
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
    author: z.string().nullable().openapi({
      description: "Username of the owner; `null` for platform (system) configurations",
    }),
    mine: z.boolean().openapi({ description: "Whether the signed-in user owns it (and so may publish or unpublish it)" }),
    createdAt: z.string().openapi({ format: "date-time" }),
    publishedAt: z.string().nullable().openapi({
      format: "date-time",
      description: "When it was published; `null` unless `visibility` is `public`",
    }),
    config: configSchema,
  })
  .openapi("SavedConfiguration");

export const idParamSchema = z.object({
  id: z.string().min(1).max(100).openapi({ description: "Configuration id" }),
});
