import { useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { AccountControl } from "./AccountControl";
import { accountAuth } from "./account-auth";
import { VINYL_DESIGNER_WIZARD_PRO_PATH } from "./identity-routes";

export function PersonalAccountGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(accountAuth.currentUser);
  const [ready, setReady] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(
        accountAuth,
        (nextUser) => {
          setUser(nextUser);
          setReady(true);
        },
        () => {
          setReady(true);
        },
      ),
    [],
  );

  if (!ready) return <main className="mg-auth-loading" />;
  if (user) return children;

  return (
    <main className="mg-page">
      <header className="mg-header">
        <a
          href={VINYL_DESIGNER_WIZARD_PRO_PATH}
          aria-label="Back to Vinyl Designer Wizard Pro"
        >
          <img src="/media/images/logos/sa-logo.png" alt="Strange Animals" />
        </a>
        <div className="mg-header-actions">
          <a href={VINYL_DESIGNER_WIZARD_PRO_PATH}>Vinyl Designer Wizard Pro</a>
        </div>
      </header>
      <div className="mg-main">
        <div className="mg-breadcrumb">
          <a href={VINYL_DESIGNER_WIZARD_PRO_PATH}>VINYL DESIGNER WIZARD PRO</a>
          <span>/</span>
          <b>MY GALLERY</b>
        </div>
        <section className="mg-auth-gate">
          <p>PERSONAL CLOUD STORAGE</p>
          <h1>My Gallery belongs to your signed-in account.</h1>
          <p>
            Your shared-key session keeps designs on this device. Sign in here
            with Google to open your private projects and versions.
          </p>
          <AccountControl signInPrompt="Sign in with Google to access your private gallery." />
          <a href={VINYL_DESIGNER_WIZARD_PRO_PATH}>Back to your local design</a>
        </section>
      </div>
    </main>
  );
}
