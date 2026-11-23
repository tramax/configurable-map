import { z } from "@hono/zod-openapi";

export const userSchema = z
  .object({ id: z.string(), username: z.string() })
  .openapi("User");

export const loginBodySchema = z
  .object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
  })
  .openapi("LoginRequest");
