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
        className="left-[55%] top-[calc(78%-2rem)] w-[min(30rem,calc(100vw-2rem))]"
        baseTransform="translateX(-50%)"
        onClose={onClose}
      >
        <div className="bg-black p-3">
          <p className="text-[0.68rem] leading-relaxed tracking-[0.04em]">
            Drag MP3 or WAV files from your computer and drop them into the
            Winamp playlist :)
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="border border-white bg-black px-3 py-1 text-[0.62rem] uppercase tracking-[0.08em] text-white hover:bg-white/35"
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
