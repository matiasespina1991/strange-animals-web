import {
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { firebaseAuth } from "@/lib/firebase";

const IDENTITY_EMAIL = "identity-access@strangeanimals.de";
const LAST_CHARACTER_REVEAL_MS = 900;
const PASSWORD_MASK_CHARACTER = "*";

type AuthStatus = "checking" | "signed-out" | "authorized";

type IdentityAccessGateProperties = {
  children: ReactNode;
};

export function IdentityAccessGate({ children }: IdentityAccessGateProperties) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [password, setPassword] = useState("");
  const [revealedCharacterIndex, setRevealedCharacterIndex] = useState<
    number | undefined
  >();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const revealTimeoutReference = useRef<number | undefined>(undefined);

  const clearRevealTimeout = () => {
    if (revealTimeoutReference.current === undefined) return;

    window.clearTimeout(revealTimeoutReference.current);
    revealTimeoutReference.current = undefined;
  };

  const scheduleRevealReset = () => {
    clearRevealTimeout();
    revealTimeoutReference.current = window.setTimeout(() => {
      setRevealedCharacterIndex(undefined);
      revealTimeoutReference.current = undefined;
    }, LAST_CHARACTER_REVEAL_MS);
  };

  useEffect(
    () => () => {
      clearRevealTimeout();
    },
    [],
  );

  useEffect(() => {
    let isActive = true;
    let unsubscribe: ReturnType<typeof onAuthStateChanged> | undefined;

    void setPersistence(firebaseAuth, browserSessionPersistence)
      .then(() => {
        if (!isActive) return;

        unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
          if (!isActive) return;

          setAuthStatus(
            user?.email?.toLowerCase() === IDENTITY_EMAIL
              ? "authorized"
              : "signed-out",
          );
        });
      })
      .catch(() => {
        if (isActive) setAuthStatus("signed-out");
      });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!password || isSubmitting) return;

    setHasError(false);
    setIsSubmitting(true);

    try {
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        IDENTITY_EMAIL,
        password,
      );

      if (credential.user.email?.toLowerCase() !== IDENTITY_EMAIL) {
        setHasError(true);
      }
    } catch {
      setHasError(true);
    } finally {
      setPassword("");
      setRevealedCharacterIndex(undefined);
      clearRevealTimeout();
      setIsSubmitting(false);
    }
  };

  const maskedPassword = useMemo(() => {
    if (password.length === 0) return "";

    return [...password]
      .map((character, index) =>
        index === revealedCharacterIndex ? character : PASSWORD_MASK_CHARACTER,
      )
      .join("");
  }, [password, revealedCharacterIndex]);

  const maskedPasswordCharacters = useMemo(
    () => [...maskedPassword],
    [maskedPassword],
  );

  const statusMessage = isSubmitting
    ? "Checking…"
    : hasError
      ? "Invalid key"
      : undefined;

  if (authStatus === "authorized") return children;

  if (authStatus === "checking") {
    return <main className="min-h-[100dvh] bg-black" />;
  }

  return (
    <main
      className="grid min-h-[100dvh] select-text place-items-center bg-black px-6 py-10 text-white"
      style={{ fontFamily: "'Departure Mono', 'Courier New', monospace" }}
    >
      <form
        aria-label="Identity access"
        aria-busy={isSubmitting}
        className="relative w-full max-w-[23rem]"
        onSubmit={handleSubmit}
      >
        <label
          className="mb-2 block text-[0.7375rem] leading-6 text-white/60"
          htmlFor="identity-access-key"
        >
          Enter key to access this section
        </label>
        <div className="relative">
          <input
            aria-describedby={
              statusMessage ? "identity-access-status" : undefined
            }
            aria-invalid={hasError}
            autoComplete="current-password"
            className="block min-h-12 w-full cursor-text rounded-none border border-white/40 bg-black px-3 py-2 text-sm leading-6 text-transparent caret-white outline-none placeholder:text-[0.6375rem] placeholder:leading-none placeholder:tracking-[0.2em] placeholder:text-white/55 placeholder:uppercase disabled:cursor-wait disabled:opacity-55 sm:text-[0.9375rem]"
            disabled={isSubmitting}
            id="identity-access-key"
            name="identity-access-key"
            placeholder="Access key"
            spellCheck={false}
            type="text"
            value={password}
            onChange={(event) => {
              const nextPassword = event.target.value;
              const nativeEvent = event.nativeEvent as InputEvent;
              const inputData = nativeEvent.data ?? "";
              const selectionEnd =
                event.target.selectionEnd ?? nextPassword.length;

              setPassword(nextPassword);

              if (
                inputData.length > 0 &&
                nativeEvent.inputType.startsWith("insert") &&
                selectionEnd > 0
              ) {
                setRevealedCharacterIndex(selectionEnd - 1);
                scheduleRevealReset();
              } else {
                setRevealedCharacterIndex(undefined);
                clearRevealTimeout();
              }

              if (hasError) setHasError(false);
            }}
          />
          {password ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 right-3 flex items-center overflow-hidden text-sm leading-6 text-white sm:text-[0.9375rem]"
            >
              {maskedPasswordCharacters.map((character, index) => (
                <span
                  key={`${index}-${character}`}
                  className={
                    character === PASSWORD_MASK_CHARACTER
                      ? "text-white/45"
                      : "text-white"
                  }
                >
                  {character}
                </span>
              ))}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p
            aria-live="polite"
            className="min-h-[1rem] text-xs leading-none text-white/70"
            id="identity-access-status"
          >
            {statusMessage ?? ""}
          </p>
          <button
            className="ml-auto block cursor-pointer border border-white bg-white px-4 py-2 text-[0.6375rem] tracking-[0.16em] text-black uppercase outline-none hover:bg-black hover:text-white disabled:cursor-wait disabled:border-white/35 disabled:bg-white/35 disabled:text-black/70"
            disabled={isSubmitting}
            type="submit"
          >
            Submit
          </button>
        </div>
      </form>
    </main>
  );
}
