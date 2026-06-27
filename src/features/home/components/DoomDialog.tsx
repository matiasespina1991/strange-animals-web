import { StrangeOsDialog } from "./StrangeOsDialog";

const doomPagePath = "/media/games/doom-on-js-dos/index.html";

type DoomDialogProperties = {
  onClose: () => void;
  open: boolean;
};

export function DoomDialog({ onClose, open }: DoomDialogProperties) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[92]">
      <StrangeOsDialog
        open={open}
        title="DOOM"
        className="left-1/2 top-1/2 !w-auto max-w-[calc(100vw-2rem)]"
        contentClassName="overflow-hidden"
        baseTransform="translate(-50%, -50%)"
        onClose={onClose}
      >
        <div className="bg-black leading-none">
          <iframe
            className="block min-w-[6rem] border-0 bg-black"
            src={doomPagePath}
            style={{
              aspectRatio: "8 / 5",
              width:
                "min(640px, calc(100vw - 3rem), calc((100vh - 8rem) * 1.6))",
            }}
            title="DOOM"
          />
        </div>
      </StrangeOsDialog>
    </div>
  );
}
