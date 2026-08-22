import {
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {type FormEvent, type ReactNode, useEffect, useState} from 'react';
import {firebaseAuth} from '@/lib/firebase';

const IDENTITY_EMAIL = 'identity-access@strangeanimals.de';

type AuthStatus = 'checking' | 'signed-out' | 'authorized';

type IdentityAccessGateProperties = {
  children: ReactNode;
};

export function IdentityAccessGate({children}: IdentityAccessGateProperties) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);

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
              ? 'authorized'
              : 'signed-out',
          );
        });
      })
      .catch(() => {
        if (isActive) setAuthStatus('signed-out');
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
      setPassword('');
      setIsSubmitting(false);
    }
  };

  const statusMessage = isSubmitting
    ? 'Checking…'
    : hasError
      ? 'Invalid key'
      : undefined;

  if (authStatus === 'authorized') return children;

  if (authStatus === 'checking') {
    return <main className="min-h-[100dvh] bg-black" />;
  }

  return (
    <main
      className="grid min-h-[100dvh] select-text place-items-center bg-black px-6 py-10 text-white"
      style={{fontFamily: "'Departure Mono', 'Courier New', monospace"}}
    >
      <form
        aria-label="Identity access"
        className="relative w-full max-w-[23rem]"
        onSubmit={handleSubmit}
      >
        <label
          className="mb-2 block text-[0.7375rem] leading-6 text-white/60"
          htmlFor="identity-access-key"
        >
          Enter key to access this section
        </label>
        <input
          aria-describedby={
            statusMessage ? 'identity-access-status' : undefined
          }
          aria-invalid={hasError}
          autoComplete="current-password"
          className="block min-h-12 w-full cursor-text rounded-none border border-white/40 bg-black px-3 py-2 text-sm leading-6 text-white caret-white outline-none placeholder:text-[0.6375rem] placeholder:leading-none placeholder:tracking-[0.2em] placeholder:text-white/55 placeholder:uppercase disabled:cursor-wait disabled:opacity-55 sm:text-[0.9375rem]"
          disabled={isSubmitting}
          id="identity-access-key"
          name="identity-access-key"
          placeholder="Access key"
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (hasError) setHasError(false);
          }}
        />
        {statusMessage ? (
          <p
            aria-live="polite"
            className="absolute top-full left-0 mt-3 text-xs leading-none text-white/70"
            id="identity-access-status"
          >
            {statusMessage}
          </p>
        ) : null}
      </form>
    </main>
  );
}
