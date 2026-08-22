import {IdentityAccessGate} from './IdentityAccessGate';
import {IdentityFontsPage} from './IdentityFontsPage';

type IdentityRouteProperties = {
  route: string;
};

export function IdentityRoute({route}: IdentityRouteProperties) {
  return (
    <IdentityAccessGate>
      {route === '/identity/fonts' ? (
        <IdentityFontsPage />
      ) : (
        <main className="min-h-[100dvh] bg-black" />
      )}
    </IdentityAccessGate>
  );
}
