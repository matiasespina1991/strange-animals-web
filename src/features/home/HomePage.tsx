import {useEffect, useMemo, useRef, useState} from 'react';
import {motion} from 'framer-motion';
import {useTadeGameStore} from '@/store/tade-game-store';
import type {WebampSkin} from '@/features/webamp-skins/webamp-skin-repository';
import {BrandLogoExperience} from './components/BrandLogoExperience';
import {CustomCursor} from './components/CustomCursor';
import {TadeGame} from './components/TadeGame';
import {useWebampLayer} from './components/WebampLayer';
import {WebampSkinDialog} from './components/WebampSkinDialog';
import {WinampTipDialog} from './components/WinampTipDialog';
import {useKeyboardSequence} from './hooks/useKeyboardSequence';

export function HomePage() {
  const activateTade = useTadeGameStore((state) => state.activate);
  const {applySkin, layer, openWebamp} = useWebampLayer();
  const hasOpenedWinampSkinDialog = useRef(false);
  const hasOpenedWinampTipDialog = useRef(false);
  const tipDialogTimeoutReference = useRef<number | null>(null);
  const selectedSkinReference = useRef<WebampSkin | null>(null);
  const [skinDialogOpen, setSkinDialogOpen] = useState(false);
  const [selectedSkin, setSelectedSkin] = useState<WebampSkin | null>(null);
  const [tipDialogOpen, setTipDialogOpen] = useState(false);
  const openWinamp = () => {
    void openWebamp('winamp', selectedSkinReference.current);

    if (!hasOpenedWinampTipDialog.current) {
      hasOpenedWinampTipDialog.current = true;
      tipDialogTimeoutReference.current = window.setTimeout(() => {
        setTipDialogOpen(true);
        tipDialogTimeoutReference.current = null;
      }, 2000);
    }

    if (!hasOpenedWinampSkinDialog.current) {
      hasOpenedWinampSkinDialog.current = true;
      setSkinDialogOpen(true);
    }
  };

  const sequences = useMemo(
    () => ({
      lain() {
        void openWebamp('lain');
      },
      tade: activateTade,
    }),
    [activateTade, openWebamp],
  );

  useKeyboardSequence(sequences);

  useEffect(
    () => () => {
      if (tipDialogTimeoutReference.current) {
        window.clearTimeout(tipDialogTimeoutReference.current);
      }
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      if (event.code === 'KeyW') {
        event.preventDefault();
        openWinamp();
      }

      if (event.code === 'KeyS') {
        event.preventDefault();
        setSkinDialogOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openWebamp]);

  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <CustomCursor />
      <TadeGame />
      <BrandLogoExperience />
      {layer}
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
        animate={{opacity: 1}}
        className="pointer-events-auto fixed bottom-5 right-7 z-40 text-right font-gruppo text-[0.775rem] leading-none tracking-[0.02em] text-white/80 opacity-0 transition-colors duration-150 ease-out hover:text-white/95"
        initial={{opacity: 0}}
        transition={{delay: 2.05, duration: 0.75, ease: 'easeOut'}}
      >
        strange animals, berlin |
      </motion.div>
    </main>
  );
}
