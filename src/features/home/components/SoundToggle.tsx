import {Volume2, VolumeX} from 'lucide-react';
import {useTadeGameStore} from '@/store/tade-game-store';

export function SoundToggle() {
  const active = useTadeGameStore((state) => state.active);
  const muted = useTadeGameStore((state) => state.muted);
  const toggleMuted = useTadeGameStore((state) => state.toggleMuted);

  if (!active) {
    return null;
  }

  return (
    <button
      aria-label={muted ? 'Activar musica' : 'Silenciar musica'}
      className="fixed right-1 top-1 z-50 inline-flex size-12 items-center justify-center rounded-full border-0 bg-black/10 text-white backdrop-blur-xl"
      type="button"
      onClick={toggleMuted}
    >
      {muted ? (
        <VolumeX aria-hidden size={18} />
      ) : (
        <Volume2 aria-hidden size={18} />
      )}
    </button>
  );
}
