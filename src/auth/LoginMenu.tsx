import { FormEvent, useEffect, useRef, useState } from "react";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-input";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-popover";
import { AuthUser, login, logout } from "./api";
import "./LoginMenu.css";

export interface LoginMenuProps {
  /** The signed-in user, or null. Owned by the parent so other features can react to it. */
  user: AuthUser | null;
  onUserChange: (user: AuthUser | null) => void;
}

/**
 * Fixed top-right account button. Opens a popover with a sign-in form,
 * or the current user and a sign-out button when logged in.
 */
export default function LoginMenu({ user, onUserChange }: LoginMenuProps) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The popover anchors to (and is toggled by) this button; kept in state so the popover re-renders once it exists.
  const [button, setButton] = useState<HTMLElement | null>(null);
  const usernameRef = useRef<HTMLCalciteInputElement>(null);

  useEffect(() => {
    if (open && !user) void usernameRef.current?.setFocus();
  }, [open, user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onUserChange(await login(username.trim(), password));
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
    onUserChange(null);
    setOpen(false);
  }

  const accountLabel = user ? `Account: ${user.username}` : "Sign in";

  return (
    <div className="login-menu">
      <calcite-button
        ref={setButton}
        round
        icon-start="user"
        kind={user ? "brand" : "neutral"}
        appearance="solid"
        label={accountLabel}
        title={user ? user.username : "Sign in"}
      />

      <calcite-popover
        referenceElement={button ?? ""}
        open={open}
        autoClose
        placement="bottom-end"
        overlayPositioning="fixed"
        label="Account"
        heading={user ? "Account" : "Sign in"}
        oncalcitePopoverOpen={() => setOpen(true)}
        oncalcitePopoverClose={() => setOpen(false)}
      >
        <div className="login-menu__panel">
          {user ? (
            <>
              <p className="login-menu__signed-in">
                Signed in as <strong>{user.username}</strong>
              </p>
              <calcite-button width="full" onClick={handleLogout}>
                Sign out
              </calcite-button>
            </>
          ) : (
            <form className="login-menu__form" onSubmit={handleSubmit}>
              <calcite-input
                ref={usernameRef}
                label-text="Username"
                autocomplete="username"
                required
                value={username}
                oncalciteInputInput={(e) => setUsername(e.target.value)}
              />
              <calcite-input
                label-text="Password"
                type="password"
                autocomplete="current-password"
                required
                value={password}
                oncalciteInputInput={(e) => setPassword(e.target.value)}
              />
              {error && (
                <calcite-notice open kind="danger" scale="s" width="full" icon role="alert">
                  <div slot="message">{error}</div>
                </calcite-notice>
              )}
              <calcite-button
                type="submit"
                width="full"
                loading={busy}
                disabled={busy}
              >
                {busy ? "Signing in…" : "Sign in"}
              </calcite-button>
            </form>
          )}
        </div>
      </calcite-popover>
    </div>
  );
}
