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
import { lazy, Suspense } from "react";

const MyspacePlayerTestPage = lazy(() => import("@/features/listen/MyspacePlayerTestPage"));
const FontFilterLabPage = import.meta.env.DEV
  ? lazy(() => import("@/features/identity/FontFilterLabPage"))
  : null;

export function App() {
  const route = usePathRoute();

  if (import.meta.env.DEV && route === "/dev/font-filter-lab" && FontFilterLabPage) {
    return <Suspense fallback={<p>Loading design lab…</p>}><FontFilterLabPage /></Suspense>;
  }

  if (route === "/listen/myspace-test") {
    return <Suspense fallback={<p>Loading player…</p>}><MyspacePlayerTestPage /></Suspense>;
  }

  if (route === "/identity" || route.startsWith("/identity/")) {
    return (
      <>
        <CustomCursor />
        <IdentityRoute route={route} />
      </>
    );
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
      <CustomCursor />
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
