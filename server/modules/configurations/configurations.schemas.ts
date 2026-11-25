import { z } from "@hono/zod-openapi";
import { configurationSchema, savedConfigurationSchema as savedConfigurationContract } from "@contract/configuration.schema";

const datasetId = z.string().min(1).max(100).openapi({ example: "landscape-trees" });

/** The configuration itself, as shared with the frontend. Named so the docs define it once. */
export const configSchema = configurationSchema
  // `.extend({})` makes a fresh copy: zod 4 schemas built before `@hono/zod-openapi` was loaded (the
  // contract may be imported first, e.g. through the db schema) lack `.openapi`, the copy has it.
  .extend({})
  .openapi("Configuration", { description: configurationSchema.description });

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

/** The response shape comes from the contract; only the docs names and example are added here. */
export const savedConfigurationSchema = savedConfigurationContract
  .extend({ datasetId, config: configSchema })
  .openapi("SavedConfiguration");

export const idParamSchema = z.object({
  id: z.string().min(1).max(100).openapi({ description: "Configuration id" }),
});
