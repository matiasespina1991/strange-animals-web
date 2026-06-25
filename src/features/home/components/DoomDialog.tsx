import {useEffect, useRef, useState} from 'react';
import {
  getDoomGameFiles,
  type DosGameFile,
} from '@/features/dos-games/dos-game-repository';
import {StrangeOsDialog} from './StrangeOsDialog';

const jsDosCssId = 'js-dos-v8-css';
const jsDosScriptId = 'js-dos-v8-script';
const jsZipScriptId = 'jszip-script';
const jsDosCssUrl = 'https://v8.js-dos.com/latest/js-dos.css';
const jsDosScriptUrl = 'https://v8.js-dos.com/latest/js-dos.js';
const jsZipScriptUrl =
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

type DosOptions = {
  autoStart?: boolean;
  backend?: 'dosbox' | 'dosboxX';
  backendLocked?: boolean;
  imageRendering?: 'pixelated' | 'smooth';
  renderAspect?: 'AsIs' | '1/1' | '5/4' | '4/3' | '16/10' | '16/9' | 'Fit';
  theme?: string;
  url?: string;
};

type DosProperties = {
  stop: () => Promise<void>;
};

declare global {
  interface Window {
    Dos?: (element: HTMLDivElement, options: DosOptions) => DosProperties;
    JSZip?: new () => {
      file: (path: string, data: Blob | string) => void;
      generateAsync: (options: {type: 'blob'}) => Promise<Blob>;
    };
  }
}

let jsDosScriptPromise: Promise<void> | null = null;
let jsZipScriptPromise: Promise<void> | null = null;
let doomBundleUrlPromise: Promise<string> | null = null;

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

async function loadJsDos() {
  loadJsDosCss();

  if (window.Dos) {
    return;
  }

  jsDosScriptPromise ??= new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `#${jsDosScriptId}`,
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => {
        resolve();
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load js-dos.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.id = jsDosScriptId;
    script.src = jsDosScriptUrl;
    script.async = true;
    script.addEventListener('load', () => {
      resolve();
    });
    script.addEventListener('error', () => {
      reject(new Error('Failed to load js-dos.'));
    });
    document.head.append(script);
  });

  await jsDosScriptPromise;

  if (!window.Dos) {
    throw new Error('js-dos loaded without exposing window.Dos.');
  }
}

async function loadJsZip() {
  if (window.JSZip) {
    return;
  }

  jsZipScriptPromise ??= new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `#${jsZipScriptId}`,
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => {
        resolve();
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load JSZip.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.id = jsZipScriptId;
    script.src = jsZipScriptUrl;
    script.async = true;
    script.addEventListener('load', () => {
      resolve();
    });
    script.addEventListener('error', () => {
      reject(new Error('Failed to load JSZip.'));
    });
    document.head.append(script);
  });

  await jsZipScriptPromise;

  if (!window.JSZip) {
    throw new Error('JSZip loaded without exposing window.JSZip.');
  }
}

async function fetchDoomFile(file: DosGameFile) {
  const response = await fetch(file.downloadUrl);

  if (!response.ok) {
    throw new Error(`Failed to load ${file.bundlePath}.`);
  }

  return {
    bundlePath: file.bundlePath,
    data: await response.blob(),
  };
}

async function createDoomBundleUrl() {
  await loadJsZip();

  const JsZip = window.JSZip;

  if (!JsZip) {
    throw new Error('JSZip is unavailable.');
  }

  const zip = new JsZip();
  zip.file(
    '.jsdos/dosbox.conf',
    ['[autoexec]', 'mount c .', 'c:', 'DOOMWEB.BAT', ''].join('\n'),
  );

  const files = await getDoomGameFiles();
  const loadedFiles = await Promise.all(
    files.map(async (file) => fetchDoomFile(file)),
  );

  for (const file of loadedFiles) {
    zip.file(file.bundlePath, file.data);
  }

  return URL.createObjectURL(await zip.generateAsync({type: 'blob'}));
}

async function getDoomBundleUrl() {
  doomBundleUrlPromise ??= createDoomBundleUrl();

  return doomBundleUrlPromise;
}

type DoomPlayerProperties = {
  open: boolean;
};

function DoomPlayer({open}: DoomPlayerProperties) {
  const containerReference = useRef<HTMLDivElement | null>(null);
  const dosReference = useRef<DosProperties | null>(null);
  const [status, setStatus] = useState('Loading DOOM...');

  useEffect(() => {
    if (!open || !containerReference.current) {
      return;
    }

    let cancelled = false;

    const startDoom = async () => {
      try {
        setStatus('Preparing DOOM...');
        const [doomBundleUrl] = await Promise.all([
          getDoomBundleUrl(),
          loadJsDos(),
        ]);

        const createDosPlayer = window.Dos;

        if (cancelled || !containerReference.current || !createDosPlayer) {
          return;
        }

        dosReference.current = createDosPlayer(containerReference.current, {
          autoStart: true,
          backend: 'dosbox',
          backendLocked: true,
          imageRendering: 'pixelated',
          renderAspect: '4/3',
          theme: 'black',
          url: doomBundleUrl,
        });
        setStatus('');
      } catch {
        if (!cancelled) {
          setStatus('DOOM failed to load.');
        }
      }
    };

    void startDoom();

    return () => {
      cancelled = true;

      if (dosReference.current) {
        void dosReference.current.stop();
        dosReference.current = null;
      }
    };
  }, [open]);

  return (
    <div className="p-2">
      <div
        ref={containerReference}
        className="relative aspect-[4/3] w-full overflow-hidden bg-black"
      >
        {status && (
          <div className="absolute inset-0 flex items-center justify-center text-[0.7rem] uppercase tracking-[0.11em] text-white/70">
            {status}
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
