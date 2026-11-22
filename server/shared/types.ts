export interface AuthUser {
  id: string;
  username: string;
}

/** Hono environment shared by every router: what middleware puts on `c.var`. */
export type AppEnv = {
  Variables: {
    /** Set by the session middleware; null when the request has no valid session. */
    user: AuthUser | null;
  };
};
