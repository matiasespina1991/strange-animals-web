import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { UserRound, X } from "lucide-react";
import { accountAuth, accountError } from "./account-auth";

export function AccountControl() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(
    () =>
      onAuthStateChanged(
        accountAuth,
        (next) => {
          setUser(next);
          setReady(true);
        },
        () => setReady(true),
      ),
    [],
  );
  return (
    <div className="dc-account">
      <button
        className="dc-account-trigger"
        disabled={!ready}
        onClick={() => setOpen(true)}
        aria-label={user ? "Account" : "Sign in"}
      >
        <UserRound size={15} />
        <span>
          {user
            ? (user.displayName ?? user.email?.split("@")[0] ?? "Account")
            : "Sign in"}
        </span>
      </button>
      {open && <AccountDialog user={user} close={() => setOpen(false)} />}
    </div>
  );
}

function AccountDialog({
  user,
  close,
}: {
  user: User | null;
  close: () => void;
}) {
  const root = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = root.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  const run = async (action: () => Promise<unknown>, dismiss = true) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setPassword("");
      if (dismiss) close();
    } catch (cause) {
      setError(accountError(cause));
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy)
      void run(() =>
        register
          ? createUserWithEmailAndPassword(accountAuth, email.trim(), password)
          : signInWithEmailAndPassword(accountAuth, email.trim(), password),
      );
  };
  return (
    <dialog
      className="dc-account-dialog"
      ref={root}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="dc-picker-heading">
        <h2 id={titleId}>
          {user ? "Account" : register ? "Create account" : "Sign in"}
        </h2>
        <button onClick={close} disabled={busy} aria-label="Close account">
          <X size={16} />
        </button>
      </div>
      {user ? (
        <>
          <p className="dc-font-explanation">
            {user.displayName ?? "Signed in"}
            <br />
            {user.email}
          </p>
          <button
            className="dc-export-confirm"
            disabled={busy}
            onClick={() => void run(() => signOut(accountAuth))}
          >
            Sign out
          </button>
        </>
      ) : (
        <form onSubmit={submit} aria-busy={busy}>
          <button
            type="button"
            className="dc-account-google"
            disabled={busy}
            onClick={() =>
              void run(() =>
                signInWithPopup(accountAuth, new GoogleAuthProvider()),
              )
            }
          >
            Continue with Google
          </button>
          <label className="dc-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="dc-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 6 : undefined}
              required
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit" className="dc-export-confirm" disabled={busy}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
          </button>
          <div className="dc-account-links">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setError("");
                setMessage("");
              }}
            >
              {register ? "Already have an account? Sign in" : "Create account"}
            </button>
            {!register && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!email.trim()) {
                    setError("Enter your email first.");
                    return;
                  }
                  void run(async () => {
                    await sendPasswordResetEmail(accountAuth, email.trim());
                    setMessage(
                      "If this email is registered, a reset link will be sent.",
                    );
                  }, false);
                }}
              >
                Forgot password?
              </button>
            )}
          </div>
        </form>
      )}
      {error && (
        <p className="dc-warning" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="dc-font-explanation" role="status">
          {message}
        </p>
      )}
    </dialog>
  );
}
