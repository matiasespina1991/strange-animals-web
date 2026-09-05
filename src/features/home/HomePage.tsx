import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTadeGameStore } from "@/store/tade-game-store";
import type { WebampSkin } from "@/features/webamp-skins/webamp-skin-repository";
import { BrandLogoExperience } from "./components/BrandLogoExperience";
import { DoomDialog } from "./components/DoomDialog";
import { JspaintDialog } from "./components/JspaintDialog";
import { MinesweeperDialog } from "./components/MinesweeperDialog";
import { TadeGame } from "./components/TadeGame";
import { useWebampLayer } from "./components/WebampLayer";
import { WebampSkinDialog } from "./components/WebampSkinDialog";
import { WinampTipDialog } from "./components/WinampTipDialog";
import { useKeyboardSequence } from "./hooks/useKeyboardSequence";

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]'),
  );
}

export function HomePage() {
  const activateTade = useTadeGameStore((state) => state.activate);
  const { applySkin, layer, openWebamp } = useWebampLayer();
  const hasOpenedWinampSkinDialog = useRef(false);
  const hasOpenedWinampTipDialog = useRef(false);
  const skinDialogTimeoutReference = useRef<number | null>(null);
  const tipDialogTimeoutReference = useRef<number | null>(null);
  const selectedSkinReference = useRef<WebampSkin | null>(null);
  const [doomDialogOpen, setDoomDialogOpen] = useState(false);
  const [jspaintDialogOpen, setJspaintDialogOpen] = useState(false);
  const [minesweeperDialogOpen, setMinesweeperDialogOpen] = useState(false);
  const [skinDialogOpen, setSkinDialogOpen] = useState(false);
  const [selectedSkin, setSelectedSkin] = useState<WebampSkin | null>(null);
  const [tipDialogOpen, setTipDialogOpen] = useState(false);
  const easterEggActive =
    doomDialogOpen ||
    jspaintDialogOpen ||
    minesweeperDialogOpen ||
    skinDialogOpen ||
    tipDialogOpen;
  const openWinamp = useCallback(() => {
    void openWebamp("winamp", selectedSkinReference.current);

    if (!hasOpenedWinampTipDialog.current) {
      hasOpenedWinampTipDialog.current = true;
      setTipDialogOpen(true);
    }

    if (!hasOpenedWinampSkinDialog.current) {
      hasOpenedWinampSkinDialog.current = true;
      skinDialogTimeoutReference.current = window.setTimeout(() => {
        setSkinDialogOpen(true);
        skinDialogTimeoutReference.current = null;
      }, 900);
    }
  }, [openWebamp]);

  const sequences = useMemo(
    () => ({
      lain() {
        void openWebamp("lain");
      },
      tade: activateTade,
    }),
    [activateTade, openWebamp],
  );

  useKeyboardSequence(sequences);

  useEffect(
    () => () => {
      if (skinDialogTimeoutReference.current) {
        window.clearTimeout(skinDialogTimeoutReference.current);
      }

      if (tipDialogTimeoutReference.current) {
        window.clearTimeout(tipDialogTimeoutReference.current);
      }
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) {
        return;
      }

      const altShortcut =
        event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
      const shiftShortcut =
        event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;

      if (!altShortcut && !shiftShortcut) {
        return;
      }

      if (event.code === "KeyW") {
        event.preventDefault();
        openWinamp();
      }

      if (event.code === "KeyD") {
        event.preventDefault();
        setDoomDialogOpen(true);
      }

      if (event.code === "KeyM") {
        event.preventDefault();
        setMinesweeperDialogOpen(true);
      }

      if (event.code === "KeyP") {
        event.preventDefault();
        setJspaintDialogOpen(true);
      }

      if (event.code === "KeyS") {
        event.preventDefault();
        setSkinDialogOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openWinamp]);

  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <TadeGame />
      <BrandLogoExperience easterEggActive={easterEggActive} />
      {layer}
      <DoomDialog
        open={doomDialogOpen}
        onClose={() => {
          setDoomDialogOpen(false);
        }}
      />
      <MinesweeperDialog
        open={minesweeperDialogOpen}
        onClose={() => {
          setMinesweeperDialogOpen(false);
        }}
      />
      <JspaintDialog
        open={jspaintDialogOpen}
        onClose={() => {
          setJspaintDialogOpen(false);
        }}
      />
      <WebampSkinDialog
        open={skinDialogOpen}
        selectedSkinId={selectedSkin?.id ?? null}
        onClose={() => {
          applySkin(selectedSkinReference.current);
          setSkinDialogOpen(false);
        }}
        onPreview={applySkin}
        onSelect={(skin) => {
          selectedSkinReference.current = skin;
          setSelectedSkin(skin);
          applySkin(skin);
        }}
      />
      <WinampTipDialog
        open={tipDialogOpen}
        onClose={() => {
          setTipDialogOpen(false);
        }}
      />
      <motion.div
        animate={{ opacity: 1 }}
        className="group pointer-events-auto fixed right-5 bottom-5 z-40 text-right font-mono text-[0.70rem] font-light leading-none tracking-[0.035em] text-white/70 opacity-0 md:right-9"
        initial={{ opacity: 0 }}
        transition={{ delay: 4.05, duration: 0.75, ease: "easeOut" }}
      >
        <nav
          aria-label="Listen to releases"
          className="pointer-events-none absolute right-0 bottom-full flex translate-y-1 flex-col items-end gap-4 pb-4 opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transition-none"
        >
          <p className="mb-0.5 text-white/55">Releases</p>
          <a
            className="cursor-pointer whitespace-nowrap text-white/45 transition-colors duration-150 hover:text-white/75 focus-visible:text-white/75 focus-visible:outline-none motion-reduce:transition-none"
            href="/listen/sajs001cd"
          >
            V.A. Odyssey Vol. 1 | TBA 2026
          </a>
          <a
            className="cursor-pointer whitespace-nowrap text-white/45 transition-colors duration-150 hover:text-white/75 focus-visible:text-white/75 focus-visible:outline-none motion-reduce:transition-none"
            href="/listen/sajs003"
          >
            {" "}
            V.A. Jazz Licks Vol. 1 | TBA 2027
          </a>
        </nav>
        <span className="cursor-default transition-colors duration-150 group-hover:text-white/85 group-focus-within:text-white/85 motion-reduce:transition-none">
          strange animals, berlin |
        </span>
      </motion.div>
    </main>
  );
}
