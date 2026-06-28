import { DoomJsDosPage } from "@/features/doom-js-dos/DoomJsDosPage";
import { HomePage } from "@/features/home/HomePage";
import { CustomCursor } from "@/features/home/components/CustomCursor";
import { MinesweeperPage } from "@/features/minesweeper";
import { ReleaseIdVerifierPage } from "@/features/release-id-verifier/ReleaseIdVerifierPage";
import { WinampSkinsStuffPicksPage } from "@/features/webamp-skins/WinampSkinsStuffPicksPage";
import { WebampSkinUploaderPage } from "@/features/webamp-skins/WebampSkinUploaderPage";
import { usePathRoute } from "@/hooks/usePathRoute";

export function App() {
  const route = usePathRoute();
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
