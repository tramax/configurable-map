import { createRoute, z } from "@hono/zod-openapi";
import { COOKIE_AUTH, errorResponse, requireJson } from "@shared/openapi";
import {
  createBodySchema,
  idParamSchema,
  listQuerySchema,
  savedConfigurationSchema,
} from "./configurations.schemas";

/** OpenAPI route declarations. The handlers live in configurations.routes.ts. */

const security = [{ [COOKIE_AUTH]: [] }];

export const defaultRoute = createRoute({
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

export const listRoute = createRoute({
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

export const createConfigRoute = createRoute({
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

export const publishRoute = createRoute({
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

export const unpublishRoute = createRoute({
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
