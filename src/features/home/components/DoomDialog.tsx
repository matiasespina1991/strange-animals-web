import {useEffect, useRef, useState} from 'react';
import {StrangeOsDialog} from './StrangeOsDialog';

const doomPagePath = '/media/games/doom-on-js-dos/index.html';

const doomControls = [
  'Arrow Up: move forward',
  'Arrow Down: move backward',
  'Arrow Left / Right: turn',
  'A / D: strafe left / right',
  'Alt + arrows: strafe modifier',
  'S: fire',
  'W: use / open',
  'Space: run',
  'Mouse: disabled.',
];

type DoomDialogProperties = {
  onClose: () => void;
  open: boolean;
};

export function DoomDialog({onClose, open}: DoomDialogProperties) {
  const fullscreenReference = useRef<HTMLDivElement>(null);
  const iframeReference = useRef<HTMLIFrameElement>(null);
  const [controlsOpen, setControlsOpen] = useState(true);

  const setCursorLock = (locked: boolean) => {
    window.dispatchEvent(
      new CustomEvent('strangeanimals-cursor-lock', {
        detail: {locked},
      }),
    );
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'strangeanimals-doom-request-fullscreen') {
        void fullscreenReference.current?.requestFullscreen?.();
      }

      if (
        event.data?.type === 'strangeanimals-doom-exit-fullscreen' &&
        document.fullscreenElement === fullscreenReference.current
      ) {
        void document.exitFullscreen?.();
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenActive =
        document.fullscreenElement === fullscreenReference.current;

      iframeReference.current?.contentWindow?.postMessage(
        {
          type: 'strangeanimals-doom-fullscreen-state',
          fullscreenActive,
        },
        window.location.origin,
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setControlsOpen(true);
    }
  }, [open]);

  return (
    <>
      <StrangeOsDialog
        open={open}
        title="DOOM.exe"
        windowId="doom"
        className="left-1/2 top-1/2 !w-auto max-w-[calc(100vw-2rem)]"
        contentClassName="overflow-hidden"
        baseTransform="translate(-50%, -50%)"
        defaultSize={{width: 640, height: 432}}
        minSize={{width: 480, height: 332}}
        onClose={onClose}
        resizeAspectRatio={8 / 5}
        resizeChromeHeight={32}
        resizeKeepsTopLeft
        resizable
      >
        <div
          ref={fullscreenReference}
          className="min-h-0 flex-1 bg-black leading-none"
          data-native-cursor-surface
          onDoubleClick={() => {
            void fullscreenReference.current?.requestFullscreen?.();
          }}
          onPointerEnter={() => {
            setCursorLock(true);
          }}
          onPointerLeave={() => {
            setCursorLock(false);
          }}
        >
          <iframe
            ref={iframeReference}
            data-doom-cursor-frame
            className="block h-full min-h-0 w-full min-w-[24rem] border-0 bg-black"
            src={doomPagePath}
            title="DOOM.exe"
          />
        </div>
      </StrangeOsDialog>
      <StrangeOsDialog
        open={open && controlsOpen}
        title="Info"
        windowId="doom-info"
        className="left-[calc(50%+21rem)] top-1/2 max-w-[calc(100vw-2rem)]"
        contentClassName="overflow-hidden"
        baseTransform="translate(0, -50%)"
        defaultSize={{width: 247, height: 360}}
        minSize={{width: 190, height: 320}}
        onClose={() => {
          setControlsOpen(false);
        }}
      >
        <div className="not-italic flex min-h-0 flex-1 flex-col bg-black text-[0.84rem] leading-[1.28] text-white/82">
          <div className="flex-1 overflow-y-auto px-3 py-2.5">
            <p className="mb-3 text-white/90">DOOM CONTROLS</p>
            <ul className="space-y-2">
              {doomControls.map((control) => (
                <li key={control}>{control}</li>
              ))}
            </ul>
          </div>
        </div>
      </StrangeOsDialog>
    </>
  );
}
