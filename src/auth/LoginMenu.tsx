import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { AuthUser, fetchCurrentUser, login, logout } from "./api";
import "./LoginMenu.css";

/**
 * Fixed top-right account button. Opens a popover with a sign-in form,
 * or the current user and a sign-out button when logged in.
 */
export default function LoginMenu() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  // Restore an existing session on load.
  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser().then((u) => {
      if (!cancelled) setUser(u);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && !user) usernameRef.current?.focus();
  }, [open, user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setUser(await login(username.trim(), password));
      setUsername("");
      setPassword("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    setOpen(false);
  }

  return (
    <div className="login-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`login-menu__button${user ? " login-menu__button--signed-in" : ""}`}
        aria-label={user ? `Account: ${user.username}` : "Sign in"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        title={user ? user.username : "Sign in"}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
          <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.76-3.58-5-8-5Z" />
        </svg>
      </button>

      {open && (
        <div id={panelId} className="login-menu__panel" role="dialog" aria-label="Account">
          {user ? (
            <>
              <p className="login-menu__signed-in">
                Signed in as <strong>{user.username}</strong>
              </p>
              <button type="button" className="login-menu__submit" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 className="login-menu__title">Sign in</h2>
              <label className="login-menu__label">
                Username
                <input
                  ref={usernameRef}
                  className="login-menu__input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="login-menu__label">
                Password
                <input
                  className="login-menu__input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              {error && (
                <p className="login-menu__error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="login-menu__submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
