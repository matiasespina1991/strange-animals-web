import {useEffect} from 'react';
import {IdentityAccessGate} from './IdentityAccessGate';
import {IdentityFontsPage} from './IdentityFontsPage';

type IdentityRouteProperties = {
  route: string;
};

export function IdentityRoute({route}: IdentityRouteProperties) {
  useEffect(() => {
    if (
      route === '/identity/fonts' ||
      route === '/identity/typefaces/fonts'
    ) {
      window.location.replace('/identity/typography/fonts');
    }
  }, [route]);

  return (
    <IdentityAccessGate>
      {route === '/identity/typography/fonts' ? (
        <IdentityFontsPage />
      ) : (
        <main className="min-h-[100dvh] bg-black" />
      )}
    </IdentityAccessGate>
  );
}
