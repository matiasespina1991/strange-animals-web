import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fallbackMediaAssets,
  type MediaAssets,
} from '../domain/media-assets';
import {getHomeMediaAssets} from '../infrastructure/firebase-media-repository';

type MediaContextValue = {
  assets: MediaAssets;
  source: 'remote';
};

const MediaContext = createContext<MediaContextValue>({
  assets: fallbackMediaAssets,
  source: 'remote',
});

type MediaProviderProperties = {
  children: ReactNode;
};

export function MediaProvider({children}: MediaProviderProperties) {
  const [assets, setAssets] = useState<MediaAssets | null>(null);

  useEffect(() => {
    let active = true;

    getHomeMediaAssets()
      .then((remoteAssets) => {
        if (!active) {
          return;
        }

        setAssets(remoteAssets);
      })
      .catch((error: unknown) => {
        console.warn('[media] could not load media assets', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      assets: assets ?? fallbackMediaAssets,
      source: 'remote' as const,
    }),
    [assets],
  );

  if (!assets) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="pointer-events-none fixed bottom-4 right-6 z-40 text-right font-sans text-[0.675rem] leading-none text-white/70">
          Strange Animals, Berlin ® 2026
        </div>
      </div>
    );
  }

  return (
    <MediaContext.Provider value={value}>{children}</MediaContext.Provider>
  );
}

export function useMediaAssets() {
  return useContext(MediaContext).assets;
}
