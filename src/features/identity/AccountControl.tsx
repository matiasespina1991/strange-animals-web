import { useEffect, useId, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { UserRound, X } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { accountAuth, accountError } from "./account-auth";

type AccountControlProperties = {
  autoOpen?: boolean;
  hideTrigger?: boolean;
  onSignedIn?: () => void;
  onClose?: () => void;
  signInPrompt?: string;
};

export function AccountControl({
  autoOpen = false,
  hideTrigger = false,
  onSignedIn,
  onClose,
  signInPrompt,
}: AccountControlProperties) {
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
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);
  const closeDialog = () => {
    setOpen(false);
    onClose?.();
  };
  return (
    <div className="dc-account">
      {!hideTrigger && (
        <button
          className="dc-account-trigger"
          disabled={!ready}
          onClick={() => setOpen(true)}
          aria-label={user ? "Account" : "Sign in"}
        >
          <UserRound size={15} fill="currentColor" strokeWidth={0} />
          <span>
            {user
              ? (user.displayName ?? user.email?.split("@")[0] ?? "Account")
              : "Sign in"}
          </span>
        </button>
      )}
      {open && (
        <AccountDialog
          user={user}
          close={closeDialog}
          onSignedIn={onSignedIn}
          signInPrompt={signInPrompt}
        />
      )}
    </div>
  );
}

function AccountDialog({
  user,
  close,
  onSignedIn,
  signInPrompt,
}: {
  user: User | null;
  close: () => void;
  onSignedIn?: () => void;
  signInPrompt?: string;
}) {
  const root = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = root.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      close();
    } catch (cause) {
      setError(accountError(cause));
    } finally {
      setBusy(false);
    }
  };
  const signInWithGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(accountAuth, new GoogleAuthProvider());
      onSignedIn?.();
      close();
    } catch (cause) {
      setError(accountError(cause));
    } finally {
      setBusy(false);
    }
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
          {user ? "Account" : "Sign in"}
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
        <>
          {signInPrompt && (
            <p className="dc-font-explanation">{signInPrompt}</p>
          )}
          <button
            type="button"
            className="dc-account-google"
            disabled={busy}
            autoFocus
            onClick={() => void signInWithGoogle()}
          >
            <FcGoogle size={19} aria-hidden="true" />
            <span>{busy ? "Please wait…" : "Continue with Google"}</span>
          </button>
        </>
      )}
      {error && (
        <p className="dc-warning" role="alert">
          {error}
        </p>
      )}
    </dialog>
  );
}
