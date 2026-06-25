import {StrangeOsDialog} from './StrangeOsDialog';

type WinampTipDialogProperties = {
  onClose: () => void;
  open: boolean;
};

export function WinampTipDialog({onClose, open}: WinampTipDialogProperties) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[85]">
      <StrangeOsDialog
        open={open}
        title="TIP!"
        titleClassName="italic"
        className="left-[55%] top-[calc(78%-2rem)] w-[min(34rem,calc(100vw-2rem))]"
        baseTransform="translateX(calc(-50% - 2rem))"
        onClose={onClose}
      >
        <div className="bg-black p-4">
          <p className="text-[0.85rem] leading-relaxed tracking-[0.11em]">
            Drag MP3 or WAV files from your computer and drop them into the
            Winamp playlist :)
          </p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="flex min-h-6 min-w-20 items-center justify-center border border-white/90 bg-black px-3 py-0.5 text-[0.75rem] uppercase leading-none tracking-[0.11em] text-white hover:bg-white/30"
              onClick={onClose}
            >
              OK
            </button>
          </div>
        </div>
      </StrangeOsDialog>
    </div>
  );
}
