import { DoomJsDosPage } from "@/features/doom-js-dos/DoomJsDosPage";
import { HomePage } from "@/features/home/HomePage";
import { CustomCursor } from "@/features/home/components/CustomCursor";
import { IdentityRoute } from "@/features/identity";
import {
  Sajs001ListenPage,
  Sajs002ListenPage,
  Sajs003ListenPage,
} from "@/features/listen";
import { MinesweeperPage } from "@/features/minesweeper";
import { ReleaseIdVerifierPage } from "@/features/release-id-verifier/ReleaseIdVerifierPage";
import { WinampSkinsStuffPicksPage } from "@/features/webamp-skins/WinampSkinsStuffPicksPage";
import { WebampSkinUploaderPage } from "@/features/webamp-skins/WebampSkinUploaderPage";
import { usePathRoute } from "@/hooks/usePathRoute";
import { PersonalAccountGate } from "@/features/identity/PersonalAccountGate";
import { IdentityAccessGate } from "@/features/identity/IdentityAccessGate";
import { lazy, Suspense } from "react";

const MyspacePlayerTestPage = lazy(
  () => import("@/features/listen/MyspacePlayerTestPage"),
);
const ARModelPage = lazy(() => import("@/features/ar-model/ARModelPage"));
const FontFilterLabPage = import.meta.env.DEV
  ? lazy(() => import("@/features/identity/FontFilterLabPage"))
  : null;
const TextEffectsLabPage = import.meta.env.DEV
  ? lazy(() => import("@/features/identity/TextEffectsLabPage"))
  : null;
const LayerPanelLayoutsLabPage = import.meta.env.DEV
  ? lazy(() => import("@/features/identity/LayerPanelLayoutsLabPage"))
  : null;
const DesignGalleryConceptsPage = import.meta.env.DEV
  ? lazy(() => import("@/features/identity/DesignGalleryConceptsPage"))
  : null;

export function App() {
  const route = usePathRoute();

  if (
    import.meta.env.DEV &&
    route === "/dev/font-filter-lab" &&
    FontFilterLabPage
  ) {
    return (
      <Suspense fallback={<p>Loading design lab…</p>}>
        <FontFilterLabPage />
      </Suspense>
    );
  }
  if (
    import.meta.env.DEV &&
    route === "/dev/text-effects-lab" &&
    TextEffectsLabPage
  ) {
    return (
      <Suspense fallback={<p>Loading design lab…</p>}>
        <TextEffectsLabPage />
      </Suspense>
    );
  }
  if (
    import.meta.env.DEV &&
    route === "/dev/layer-panel-layouts" &&
    LayerPanelLayoutsLabPage
  ) {
    return (
      <Suspense fallback={<p>Loading panel layouts…</p>}>
        <LayerPanelLayoutsLabPage />
      </Suspense>
    );
  }
  if (
    import.meta.env.DEV &&
    route === "/dev/design-gallery-concepts" &&
    DesignGalleryConceptsPage
  ) {
    return (
      <Suspense fallback={<p>Loading gallery concepts…</p>}>
        <DesignGalleryConceptsPage />
      </Suspense>
    );
  }

  if (route === "/listen/myspace-test") {
    return (
      <Suspense fallback={<p>Loading player…</p>}>
        <MyspacePlayerTestPage />
      </Suspense>
    );
  }

  const sharedModelMatch = route.match(
    /^\/(?:model\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  );
  if (route === "/ar-model" || sharedModelMatch) {
    return (
      <Suspense fallback={<p>Loading 3D model viewer…</p>}>
        <ARModelPage shareId={sharedModelMatch?.[1]} />
      </Suspense>
    );
  }

  if (route === "/identity/my-gallery/model") {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("projectId");
    const versionId = params.get("versionId");
    if (!projectId || !versionId) {
      window.location.replace("/identity/my-gallery");
      return null;
    }
    return (
      <IdentityAccessGate>
        <PersonalAccountGate>
          <Suspense fallback={<p>Loading 3D model viewer…</p>}>
            <ARModelPage galleryModel={{ projectId, versionId }} />
          </Suspense>
        </PersonalAccountGate>
      </IdentityAccessGate>
    );
  }

  if (route === "/identity" || route.startsWith("/identity/")) {
    return <IdentityRoute route={route} />;
  }

  let page = <HomePage />;

  if (route === "/services/release-id-verifier") {
    page = <ReleaseIdVerifierPage />;
  }

  if (route === "/webamp-skin-uploader") {
    page = <WebampSkinUploaderPage />;
  }

  if (route === "/winamp-skins-stuff-picks") {
    page = <WinampSkinsStuffPicksPage />;
  }

  if (route === "/minesweeper") {
    page = <MinesweeperPage />;
  }

  if (route === "/doom") {
    page = <DoomJsDosPage />;
  }

  if (route === "/listen/sajs001cd") {
    page = <Sajs001cdRedirect />;
  }

  if (route === "/listen/sajs001") {
    page = <Sajs001ListenPage />;
  }

  if (route === "/listen/sajs002") {
    page = <Sajs002ListenPage />;
  }

  if (route === "/listen/sajs003") {
    page = <Sajs003ListenPage />;
  }

  return (
    <>
      {route === "/" ? <CustomCursor /> : null}
      {page}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[980]"
        style={{ backdropFilter: "blur(0.2px)" }}
      />
    </>
  );
}

function Sajs001cdRedirect() {
  useEffect(() => {
    window.location.replace("/listen/sajs001");
  }, []);

  return null;
}
import { useEffect } from "react";
