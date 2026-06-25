import {useCallback, useRef} from 'react';
import {useMediaAssets} from '@/media/react/MediaProvider';
import type {WebampSkin} from '@/features/webamp-skins/webamp-skin-repository';
import type {WebampTrack} from 'webamp/butterchurn';

const lainTracks: WebampTrack[] = [
  {
    url: 'https://archive.org/download/sel-bootleg-cd.-7z_202108/Serial%20experiments%20lain%2F%5B01%5D%20Soundtracks%2F1998.08.05%20-%20DUVET%20%7BPSDR-5310%7D%2F01.%20Duvet.mp3?tunnel=1',
    metaData: {
      title: 'Bôa - Duvet.mp3',
    },
  },
];

type WebampWindowState = {
  position: {
    x: number;
    y: number;
  };
};

type WebampStoreAccess = {
  store: {
    dispatch: (
      action:
        | {
            absolute?: boolean;
            positions?: Record<string, {x: number; y: number}>;
            type: 'UPDATE_WINDOW_POSITIONS';
          }
        | {
            size: [number, number];
            type: 'WINDOW_SIZE_CHANGED';
            windowId: 'milkdrop' | 'playlist';
          },
    ) => void;
    getState: () => {
      windows?: {
        genWindows?: Record<string, WebampWindowState>;
      };
    };
  };
};

const getWebampTargetLeft = () => (window.innerWidth >= 640 ? 28 : 16);
const webampScale = 1.05;
const milkdropOffsetFromMain = {
  x: 275,
  y: 0,
};
const milkdropExtraSize = {
  width: 2,
  height: 3,
};
const playlistExtraSize = {
  width: 0,
  height: 3,
};

function raiseMilkdropWindow(layer: HTMLElement) {
  const milkdropCanvas = layer.querySelector<HTMLCanvasElement>(
    '#webamp .gen-window canvas',
  );
  const milkdropWindow = milkdropCanvas?.closest<HTMLElement>('.gen-window');
  const focusTarget = milkdropWindow?.parentElement;
  const windowWrapper = focusTarget?.parentElement;

  if (!windowWrapper) {
    return;
  }

  windowWrapper.style.zIndex = '999';
}

function scheduleRaiseMilkdropWindow(layer: HTMLElement) {
  window.requestAnimationFrame(() => {
    raiseMilkdropWindow(layer);
  });
}

function applyWebampLayout(webamp: WebampStoreAccess) {
  const windows = webamp.store.getState().windows?.genWindows;
  const mainWindow = windows?.main;

  if (!windows || !mainWindow) {
    return;
  }

  const deltaX = getWebampTargetLeft() / webampScale - mainWindow.position.x;
  const deltaY = (window.innerHeight / 2) * (1 / webampScale - 1);
  const positions = Object.fromEntries(
    Object.entries(windows).map(([windowId, windowState]) => {
      if (windowId === 'milkdrop') {
        return [
          windowId,
          {
            x: mainWindow.position.x + deltaX + milkdropOffsetFromMain.x,
            y: mainWindow.position.y + deltaY + milkdropOffsetFromMain.y,
          },
        ];
      }

      return [
        windowId,
        {
          x: windowState.position.x + deltaX,
          y: windowState.position.y + deltaY,
        },
      ];
    }),
  );

  webamp.store.dispatch({
    absolute: true,
    positions,
    type: 'UPDATE_WINDOW_POSITIONS',
  });

  webamp.store.dispatch({
    size: [milkdropExtraSize.width, milkdropExtraSize.height],
    type: 'WINDOW_SIZE_CHANGED',
    windowId: 'milkdrop',
  });

  webamp.store.dispatch({
    size: [playlistExtraSize.width, playlistExtraSize.height],
    type: 'WINDOW_SIZE_CHANGED',
    windowId: 'playlist',
  });
}

export function useWebamp(layerReference: React.RefObject<HTMLDivElement>) {
  const assets = useMediaAssets();
  const webampReference = useRef<import('webamp/butterchurn').default | null>(
    null,
  );
  const loadingReference = useRef(false);
  const activeWinampSkinIdReference = useRef<string | null>(null);
  const winampTracks: WebampTrack[] = [
    {
      url: assets.audio.bluejaye,
      metaData: {
        title: 'Bluejaye - Beginning (Live Mix) EDIT low.mp3',
      },
    },
    {
      url: assets.audio.sillizium,
      metaData: {
        title: 'Sillizium - ColdSunset.mp3',
      },
    },
    {
      url: assets.audio.tadeKop,
      metaData: {
        title: 'Tade Kop - Untitled.mp3',
      },
    },
  ];

  const applySkin = useCallback((skin: WebampSkin | null) => {
    if (!webampReference.current) {
      return;
    }

    if (!skin) {
      if (activeWinampSkinIdReference.current === null) {
        return;
      }

      (
        webampReference.current as unknown as {
          store: {dispatch: (action: {type: string}) => void};
        }
      ).store.dispatch({
        type: 'LOAD_DEFAULT_SKIN',
      });
      activeWinampSkinIdReference.current = null;
      return;
    }

    if (activeWinampSkinIdReference.current === skin.id) {
      return;
    }

    webampReference.current.setSkinFromUrl(skin.downloadUrl);
    activeWinampSkinIdReference.current = skin.id;
  }, []);

  const openWebamp = useCallback(
    async (mode: 'winamp' | 'lain', skin?: WebampSkin | null) => {
      const layer = layerReference.current;

      if (!layer || loadingReference.current) {
        return;
      }

      layer.classList.remove('hidden');

      if (webampReference.current) {
        webampReference.current.reopen();
        applyWebampLayout(
          webampReference.current as unknown as WebampStoreAccess,
        );
        scheduleRaiseMilkdropWindow(layer);

        if (mode === 'lain') {
          webampReference.current.setSkinFromUrl(assets.webampSkins.lain);
          activeWinampSkinIdReference.current = 'lain';
          webampReference.current.setTracksToPlay(lainTracks);
        } else {
          if (skin) {
            webampReference.current.setSkinFromUrl(skin.downloadUrl);
            activeWinampSkinIdReference.current = skin.id;
          } else {
            applySkin(null);
          }

          webampReference.current.setTracksToPlay(winampTracks);
        }

        webampReference.current.play();
        return;
      }

      loadingReference.current = true;

      try {
        const {default: Webamp} = await import('webamp/butterchurn');
        const webamp = new Webamp({
          initialTracks: mode === 'lain' ? lainTracks : winampTracks,
          ...(mode === 'lain'
            ? {initialSkin: {url: assets.webampSkins.lain}}
            : skin
              ? {initialSkin: {url: skin.downloadUrl}}
              : {}),
          windowLayout: {
            main: {position: {top: 0, left: 0}},
            equalizer: {position: {top: 116, left: 0}},
            playlist: {
              position: {top: 232, left: 0},
              size: {
                extraWidth: playlistExtraSize.width,
                extraHeight: playlistExtraSize.height,
              },
            },
            milkdrop: {
              position: {
                top: milkdropOffsetFromMain.y,
                left: milkdropOffsetFromMain.x,
              },
              size: {
                extraWidth: milkdropExtraSize.width,
                extraHeight: milkdropExtraSize.height,
              },
            },
          },
        });

        webampReference.current = webamp;
        await webamp.renderWhenReady(layer);
        applyWebampLayout(webamp as unknown as WebampStoreAccess);
        scheduleRaiseMilkdropWindow(layer);
        activeWinampSkinIdReference.current =
          mode === 'lain' ? 'lain' : (skin?.id ?? null);
        webamp.play();
      } finally {
        loadingReference.current = false;
      }
    },
    [
      applySkin,
      assets.audio.bluejaye,
      assets.audio.sillizium,
      assets.audio.tadeKop,
      assets.webampSkins.lain,
      layerReference,
      winampTracks,
    ],
  );

  return {applySkin, openWebamp};
}
