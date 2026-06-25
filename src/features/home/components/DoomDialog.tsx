import {useEffect, useRef, useState} from 'react';
import {StrangeOsDialog} from './StrangeOsDialog';

const jqueryScriptId = 'jquery-script';
const jqueryScriptUrl = 'https://code.jquery.com/jquery-3.6.0.min.js';
const jsDosScriptId = 'js-dos-api-script';
const jsDosScriptUrl = 'https://thedoggybrad.github.io/doom_on_js-dos/js-dos-api.js';

let jsDosScriptPromise: Promise<void> | null = null;
let jqueryScriptPromise: Promise<void> | null = null;

declare global {
  interface Window {
    Dosbox?: any;
    jQuery?: any;
    $?: any;
  }
}

function loadScript(id: string, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(id) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error(`Failed to load script ${url}.`)));
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = url;
    script.type = 'text/javascript';
    script.async = false;
    script.defer = false;
    script.crossOrigin = 'anonymous';
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error(`Failed to load script ${url}.`)));
    document.head.append(script);
  });
}

async function loadJsDosApi(): Promise<void> {
  if (!window.$ && !window.jQuery) {
    jqueryScriptPromise ??= loadScript(jqueryScriptId, jqueryScriptUrl);
    await jqueryScriptPromise;
  }

  if (!window.Dosbox) {
    jsDosScriptPromise ??= loadScript(jsDosScriptId, jsDosScriptUrl);
    await jsDosScriptPromise;
  }

  if (!window.$ && !window.jQuery) {
    throw new Error('jQuery failed to attach to window before js-dos API executed.');
  }

  if (!window.Dosbox) {
    throw new Error('js-dos API loaded without exposing window.Dosbox.');
  }
}

type DoomPlayerProperties = {
  open: boolean;
};

function DoomPlayer({open}: DoomPlayerProperties) {
  const containerId = useRef('DOOM');
  const dosReference = useRef<any>(null);
  const [status, setStatus] = useState('Loading DOOM...');

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const startDoom = async () => {
      try {
        setStatus('Preparing DOOM...');
        await loadJsDosApi();

        if (cancelled || !window.Dosbox) {
          return;
        }

        dosReference.current = new window.Dosbox({
          id: containerId.current,
          onload: (dosbox: any) => {
            dosbox.run(
              'https://thedoggybrad.github.io/doom_on_js-dos/DOOM-@evilution.zip',
              './DOOM/DOOM.EXE',
            );
          },
          onrun: (dosbox: any, app: string) => {
            console.log("App '" + app + "' is runned");
          },
        });

        setStatus('');
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setStatus('DOOM failed to load.');
        }
      }
    };

    void startDoom();

    return () => {
      cancelled = true;
      if (dosReference.current && typeof dosReference.current.destroy === 'function') {
        dosReference.current.destroy();
      }
      dosReference.current = null;
    };
  }, [open]);

  return (
    <div className="p-2">
      <div id={containerId.current} className="relative aspect-[4/3] w-full overflow-hidden bg-black">
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
