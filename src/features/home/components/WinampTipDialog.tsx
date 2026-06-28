import { DialogButton } from "./DialogButton";
import { StrangeOsDialog } from "./StrangeOsDialog";

type WinampTipDialogProperties = {
  onClose: () => void;
  open: boolean;
};

export function WinampTipDialog({ onClose, open }: WinampTipDialogProperties) {
  return (
    <StrangeOsDialog
      open={open}
      title="TIP!"
      windowId="winamp-tip"
      className="left-[55%] top-[calc(78%-2rem)] w-[min(34rem,calc(100vw-2rem))]"
      baseTransform="translateX(calc(-50% - 2rem))"
      onClose={onClose}
    >
      <div className="bg-black p-4">
        <p className="text-[0.85rem] leading-relaxed tracking-[0.11em]">
          Drag MP3 or WAV files from your computer and drop them into the Winamp
          playlist :)
        </p>
        <div className="mt-4 flex justify-end">
          <DialogButton onClick={onClose}>OK</DialogButton>
        </div>
      </div>
    </StrangeOsDialog>
  );
}
