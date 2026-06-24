import {useEffect, useState} from 'react';
import {useTadeGameStore} from '@/store/tade-game-store';
import {gameConfig} from '../lib/game-config';

export function TadeVideoBackground() {
  const active = useTadeGameStore((state) => state.active);
  const [started, setStarted] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!active) {
      setRevealed(false);
      return;
    }

    setStarted(true);
    setRevealed(false);

    const revealTimer = window.setTimeout(() => {
      setRevealed(true);
    }, 4000);

    return () => {
      window.clearTimeout(revealTimer);
    };
  }, [active]);

  if (!active && !started) {
    return null;
  }

  return (
    <iframe
      aria-hidden="true"
      allow="autoplay; encrypted-media"
      className={[
        'pointer-events-none fixed inset-0 z-0 h-screen w-screen scale-125 select-none border-0 transition-opacity duration-700',
        active && revealed ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
      draggable={false}
      src={started ? gameConfig.tadeVideoBackgroundUrl : 'about:blank'}
      tabIndex={-1}
      title="Tade background video"
    />
  );
}
