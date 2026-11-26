export const SESSION_COOKIE = "session";

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "Lax" as const,
    secure,
    path: "/",
  };
}
