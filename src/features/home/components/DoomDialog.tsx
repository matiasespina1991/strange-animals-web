import {useEffect, useRef, useState} from 'react';
import {getDoomBundleUrl} from '@/features/dos-games/dos-game-repository';
import {StrangeOsDialog} from './StrangeOsDialog';

const jsDosCssId = 'js-dos-v8-css';
const jsDosEmulatorsScriptId = 'js-dos-v8-emulators-script';
const jsDosScriptId = 'js-dos-v8-script';
const jsDosBasePath = '/js-dos/';
const jsDosEmulatorsPath = `${jsDosBasePath}emulators/`;
const jsDosCssUrl = `${jsDosBasePath}js-dos.css`;
const jsDosEmulatorsScriptUrl = `${jsDosEmulatorsPath}emulators.js`;
const jsDosScriptUrl = `${jsDosBasePath}js-dos.js`;

type DosOptions = {
  autoSave?: boolean;
  autoStart?: boolean;
  background?: string;
  backend?: 'dosbox' | 'dosboxX';
  backendLocked?: boolean;
  countDownStart?: boolean;
  imageRendering?: 'pixelated' | 'smooth';
  kiosk?: boolean;
  mouseCapture?: boolean;
  noCloud?: boolean;
  noCursor?: boolean;
  pathPrefix?: string;
  renderAspect?: 'AsIs' | '1/1' | '5/4' | '4/3' | '16/10' | '16/9' | 'Fit';
  theme?: string;
  url?: string;
  volume?: number;
};

type DosProperties = {
  setAutoSave?: (enabled: boolean) => void;
  setNoCloud?: (enabled: boolean) => void;
  setVolume?: (volume: number) => void;
  stop: () => Promise<void>;
};

declare global {
  interface Window {
    Dos?: (
      element: HTMLDivElement,
      options: DosOptions,
    ) => DosProperties | Promise<DosProperties>;
    emulators?: {
      pathPrefix?: string;
    };
  }
}

let jsDosEmulatorsScriptPromise: Promise<void> | null = null;
let jsDosScriptPromise: Promise<void> | null = null;
const loadedScriptIds = new Set<string>();

function loadJsDosCss() {
  if (document.querySelector(`#${jsDosCssId}`)) {
    return;
  }

  const link = document.createElement('link');
  link.id = jsDosCssId;
  link.rel = 'stylesheet';
  link.href = jsDosCssUrl;
  document.head.append(link);
}

async function loadScript(id: string, url: string) {
  if (loadedScriptIds.has(id)) {
    return;
  }

  const existingScript = document.querySelector<HTMLScriptElement>(`#${id}`);

  if (existingScript) {
    if (existingScript.dataset.loaded === 'true') {
      loadedScriptIds.add(id);
      return;
    }

    return new Promise<void>((resolve, reject) => {
      existingScript.addEventListener('load', () => {
        existingScript.dataset.loaded = 'true';
        loadedScriptIds.add(id);
        resolve();
      });
      existingScript.addEventListener('error', () => {
        reject(new Error(`Failed to load ${url}.`));
      });
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = url;
    script.async = true;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      loadedScriptIds.add(id);
      resolve();
    });
    script.addEventListener('error', () => {
      reject(new Error(`Failed to load ${url}.`));
    });
    document.head.append(script);
  });
}

async function loadJsDos() {
  loadJsDosCss();

  if (!window.emulators) {
    jsDosEmulatorsScriptPromise ??= loadScript(
      jsDosEmulatorsScriptId,
      jsDosEmulatorsScriptUrl,
    );
    await jsDosEmulatorsScriptPromise;
  }

  if (window.emulators) {
    window.emulators.pathPrefix = jsDosEmulatorsPath;
  }

  if (window.Dos) {
    return;
  }

  jsDosScriptPromise ??= loadScript(jsDosScriptId, jsDosScriptUrl);
  await jsDosScriptPromise;

  if (!window.Dos) {
    throw new Error('js-dos loaded without exposing window.Dos.');
  }
}

type DoomPlayerProperties = {
  open: boolean;
};

function DoomPlayer({open}: DoomPlayerProperties) {
  const containerReference = useRef<HTMLDivElement | null>(null);
  const dosReference = useRef<DosProperties | null>(null);
  const [doomBundleUrl, setDoomBundleUrl] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState('Loading DOOM...');

  useEffect(() => {
    const container = containerReference.current;

    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      window.dispatchEvent(new Event('resize'));
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const prepareDoom = async () => {
      try {
        setStatus('Loading DOOM...');
        const [doomBundleUrl] = await Promise.all([
          getDoomBundleUrl(),
          loadJsDos(),
        ]);

        if (cancelled) {
          return;
        }

        setDoomBundleUrl(doomBundleUrl);
        setRuntimeReady(true);
        setStatus('Click START to run DOOM.');
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setStatus('DOOM failed to load.');
        }
      }
    };

    void prepareDoom();

    return () => {
      cancelled = true;

      if (dosReference.current) {
        void dosReference.current.stop();
        dosReference.current = null;
      }
    };
  }, [open]);

  const startDoom = async () => {
    const createDosPlayer = window.Dos;

    if (
      !doomBundleUrl ||
      !runtimeReady ||
      !containerReference.current ||
      !createDosPlayer ||
      dosReference.current
    ) {
      return;
    }

    try {
      setStatus('');
      setStarted(true);

      const dos = await createDosPlayer(containerReference.current, {
        autoSave: false,
        autoStart: true,
        background: '#000000',
        imageRendering: 'pixelated',
        kiosk: true,
        noCloud: true,
        pathPrefix: jsDosEmulatorsPath,
        renderAspect: '4/3',
        theme: 'black',
        url: doomBundleUrl,
      });

      dos.setNoCloud?.(true);
      dos.setAutoSave?.(false);
      dos.setVolume?.(0.8);
      dosReference.current = dos;
      window.dispatchEvent(new Event('resize'));
      window.setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 250);
    } catch (error) {
      console.error(error);
      setStarted(false);
      setStatus('DOOM failed to start.');
    }
  };

  return (
    <div className="p-2">
      <div
        ref={containerReference}
        className="doom-jsdos-container relative aspect-[4/3] w-full overflow-hidden bg-black"
      >
        {status && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-[0.7rem] uppercase tracking-[0.11em] text-white/70">
            <span>{status}</span>
            {doomBundleUrl && runtimeReady && !started && (
              <button
                type="button"
                className="border-[0.25px] border-white/90 bg-black px-4 py-1.5 text-white/90 hover:bg-white/25"
                onClick={() => {
                  void startDoom();
                }}
              >
                START
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type DoomDialogProperties = {
  onClose: () => void;
  open: boolean;
};

export function DoomDialog({onClose, open}: DoomDialogProperties) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <StrangeOsDialog
        open={open}
        title="DOOM"
        className="left-1/2 top-1/2 w-[min(36rem,calc(100vw-2rem))]"
        baseTransform="translate(-50%, -50%)"
        onClose={onClose}
      >
        <DoomPlayer open={open} />
      </StrangeOsDialog>
    </div>
  );
}
