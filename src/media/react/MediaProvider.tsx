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
    return <div className="min-h-screen bg-black" />;
  }

  return (
    <MediaContext.Provider value={value}>{children}</MediaContext.Provider>
  );
}

export function useMediaAssets() {
  return useContext(MediaContext).assets;
}
