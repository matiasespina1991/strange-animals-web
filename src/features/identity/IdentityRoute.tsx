import { useEffect } from "react";
import { IdentityAccessGate } from "./IdentityAccessGate";
import { IdentityFontsPage } from "./IdentityFontsPage";
import { IdentityTypefacesLab } from "./IdentityTypefacesLab";
import { IdentityDesignConfigurator } from "./IdentityDesignConfigurator";
import { PersonalAccountGate } from "./PersonalAccountGate";
import MyGalleryPage from "./MyGalleryPage";
import {
  LEGACY_DESIGN_CONFIGURATOR_PATH,
  VINYL_DESIGNER_CONFIGURATOR_PATH,
} from "./identity-routes";

type IdentityRouteProperties = {
  route: string;
};

export function IdentityRoute({ route }: IdentityRouteProperties) {
  useEffect(() => {
    if (route === LEGACY_DESIGN_CONFIGURATOR_PATH) {
      window.location.replace(
        `${VINYL_DESIGNER_CONFIGURATOR_PATH}${window.location.search}${window.location.hash}`,
      );
      return;
    }
    if (
      route === "/identity/fonts" ||
      route === "/identity/typefaces/fonts" ||
      route === "/identity/typography/fonts"
    ) {
      window.location.replace("/identity/typography/typefaces");
    }
  }, [route]);

  if (route === LEGACY_DESIGN_CONFIGURATOR_PATH) return null;

  return (
    <IdentityAccessGate>
      {route === VINYL_DESIGNER_CONFIGURATOR_PATH ||
      route === "/identity/my-gallery" ? (
        <IdentityDesignConfigurator
          initialView={route === "/identity/my-gallery" ? "gallery" : "editor"}
        />
      ) : route === "/identity/typography/typefaces/n" ? (
        <IdentityTypefacesLab />
      ) : route === "/identity/typography/typefaces" ? (
        <IdentityFontsPage />
      ) : (
        <main className="min-h-[100dvh] bg-black" />
      )}
    </IdentityAccessGate>
  );
}
