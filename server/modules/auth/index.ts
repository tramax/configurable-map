// Public surface of the auth module. Other modules import from here, not from its internal files.
export { authRoutes } from "./auth.routes";
export { loadSession, requireAuth } from "./auth.middleware";
export { hashPassword } from "./password";
export { SESSION_COOKIE } from "./cookie";
