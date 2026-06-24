import {useEffect, useState} from 'react';
import {useTadeGameStore} from '@/store/tade-game-store';

function formatGameTime(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const twoDigits = (value: number) => String(value).padStart(2, '0');

  if (days > 0) {
    return `${days}d ${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
  }

  if (hours > 0) {
    return `${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
  }

  return `${twoDigits(minutes)}:${twoDigits(seconds)}`;
}

export function GameHud() {
  const active = useTadeGameStore((state) => state.active);
  const score = useTadeGameStore((state) => state.score);
  const startedAt = useTadeGameStore((state) => state.startedAt);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      return;
    }

    const update = () => {
      setElapsedSeconds(Math.floor((performance.now() - startedAt) / 1000));
    };

    const interval = window.setInterval(update, 250);
    update();

    return () => {
      window.clearInterval(interval);
    };
  }, [startedAt]);

  return (
    <div
      aria-hidden={!active}
      className={[
        'pointer-events-none fixed bottom-12 right-6 z-50 grid gap-1 text-left font-mono text-sm leading-none text-white transition-opacity duration-[1600ms] ease-out',
        active ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      <div>TIEMPO: {formatGameTime(elapsedSeconds)}</div>
      <div>PONTUAÇÃO: {score}</div>
    </div>
  );
}
