import {create} from 'zustand';
import {gameConfig} from '@/features/home/lib/game-config';

type TadeTrack = 'enya' | 'aphex';

type TadeGameState = {
  active: boolean;
  score: number;
  startedAt: number | null;
  muted: boolean;
  currentTrack: TadeTrack;
  speedMultiplier: number;
  activate: () => void;
  addScore: (points: number) => void;
  toggleMuted: () => void;
  setCurrentTrack: (track: TadeTrack) => void;
};

export const useTadeGameStore = create<TadeGameState>((set, get) => ({
  active: false,
  score: 0,
  startedAt: null,
  muted: false,
  currentTrack: 'enya',
  speedMultiplier: 1,
  activate() {
    set((state) => ({
      active: true,
      startedAt: state.startedAt ?? performance.now(),
    }));
  },
  addScore(points) {
    const score = get().score + points;

    set({
      score,
      speedMultiplier: Math.min(
        1 + score * gameConfig.speedPerPoint,
        gameConfig.maxSpeedMultiplier,
      ),
    });
  },
  toggleMuted() {
    set((state) => ({muted: !state.muted}));
  },
  setCurrentTrack(currentTrack) {
    set({currentTrack});
  },
}));
