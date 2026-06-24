import {useEffect, useRef} from 'react';
import {useMediaAssets} from '@/media/react/MediaProvider';
import {useTadeGameStore} from '@/store/tade-game-store';

export function useTadeGameAudio() {
  const assets = useMediaAssets();
  const audioReference = useRef<HTMLAudioElement | null>(null);
  const mutedReference = useRef(false);
  const active = useTadeGameStore((state) => state.active);
  const muted = useTadeGameStore((state) => state.muted);
  const setCurrentTrack = useTadeGameStore((state) => state.setCurrentTrack);

  useEffect(() => {
    mutedReference.current = muted;
    const audio = audioReference.current;

    if (audio) {
      audio.muted = muted;
      audio.volume = muted ? 0 : 1;
    }
  }, [muted]);

  useEffect(() => {
    if (!active || !assets.audio.enya || !assets.audio.aphex) {
      return;
    }

    if (!audioReference.current) {
      const audio = new Audio(assets.audio.enya);
      audio.loop = false;
      audioReference.current = audio;

      const switchToAphex = () => {
        if (audio.dataset.track !== 'enya') {
          return;
        }

        audio.dataset.track = 'aphex';
        setCurrentTrack('aphex');
        audio.src = assets.audio.aphex;
        audio.loop = true;
        audio.muted = mutedReference.current;
        audio.volume = mutedReference.current ? 0 : 1;
        audio.load();
        void audio.play();
      };

      audio.dataset.track = 'enya';
      audio.addEventListener('ended', switchToAphex);
      audio.addEventListener('timeupdate', () => {
        if (
          Number.isFinite(audio.duration) &&
          audio.duration > 0 &&
          audio.currentTime >= audio.duration - 0.25
        ) {
          switchToAphex();
        }
      });
    }

    const audio = audioReference.current;
    audio.muted = muted;
    audio.volume = muted ? 0 : 1;
    void audio.play();
  }, [active, assets.audio.aphex, assets.audio.enya, muted, setCurrentTrack]);
}
