import {useEffect} from 'react';
import {IdentityAccessGate} from './IdentityAccessGate';
import {IdentityFontsPage} from './IdentityFontsPage';
import {IdentityTypefacesLab} from './IdentityTypefacesLab';
import {IdentityDesignConfigurator} from './IdentityDesignConfigurator';
import {PersonalAccountGate} from './PersonalAccountGate';
import MyGalleryPage from './MyGalleryPage';

type IdentityRouteProperties = {
  route: string;
};

export function IdentityRoute({route}: IdentityRouteProperties) {
  useEffect(() => {
    if (
      route === '/identity/fonts' ||
      route === '/identity/typefaces/fonts' ||
      route === '/identity/typography/fonts'
    ) {
      window.location.replace('/identity/typography/typefaces');
    }
  }, [route]);

  return (
    <IdentityAccessGate>
      {route === '/identity/design-configurator' ? (
        <IdentityDesignConfigurator />
      ) : route === '/identity/my-gallery' ? (
        <PersonalAccountGate>
          <MyGalleryPage />
        </PersonalAccountGate>
      ) : route === '/identity/typography/typefaces/n' ? (
        <IdentityTypefacesLab />
      ) : route === '/identity/typography/typefaces' ? (
        <IdentityFontsPage />
      ) : (
        <main className="min-h-[100dvh] bg-black" />
      )}
    </IdentityAccessGate>
  );
}
