import { useEffect } from "react";
import { IdentityAccessGate } from "./IdentityAccessGate";
import { IdentityFontsPage } from "./IdentityFontsPage";

type IdentityRouteProperties = {
  route: string;
};

export function IdentityRoute({ route }: IdentityRouteProperties) {
  useEffect(() => {
    if (
      route === "/identity/fonts" ||
      route === "/identity/typefaces/fonts" ||
      route === "/identity/typography/fonts"
    ) {
      window.location.replace("/identity/typography/typefaces");
    }
  }, [route]);

  return (
    <IdentityAccessGate>
      {route === "/identity/typography/typefaces" ? (
        <IdentityFontsPage />
      ) : (
        <main className="min-h-[100dvh] bg-black" />
      )}
    </IdentityAccessGate>
  );
}
