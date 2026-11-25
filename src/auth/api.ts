export interface AuthUser {
  id: string;
  username: string;
}

/**
 * Client for the auth endpoints (see server/modules/auth). The session lives in an HttpOnly cookie,
 * so the browser never sees the token - we only ask the server who we are.
 *
 *   GET  /api/auth/me      -> 200 AuthUser | 401
 *   POST /api/auth/login   -> 200 AuthUser | 401   body: { username, password }
 *   POST /api/auth/logout  -> 204
 */

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    return res.ok ? ((await res.json()) as AuthUser) : null;
  } catch {
    return null;
  }
}

export async function login(username: string, password: string): Promise<AuthUser> {
  let res: Response;
  try {
    res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new Error("Unable to reach the server. Please try again.");
  }
  if (res.status === 401) throw new Error("Invalid username or password.");
  if (!res.ok) throw new Error("Sign in failed. Please try again.");
  return (await res.json()) as AuthUser;
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  } catch {
    // Nothing useful to do; the UI still clears its local state.
  }
}
