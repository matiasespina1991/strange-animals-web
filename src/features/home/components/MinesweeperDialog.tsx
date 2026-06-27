import {Minesweeper} from '@/features/minesweeper';
import {StrangeOsDialog} from './StrangeOsDialog';

type MinesweeperDialogProperties = {
  open: boolean;
  onClose: () => void;
};

export function MinesweeperDialog({
  open,
  onClose,
}: MinesweeperDialogProperties) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[92]">
      <StrangeOsDialog
        open={open}
        title="minesweeper"
        className="left-1/2 top-1/2 !w-auto max-w-[calc(100vw-2rem)]"
        contentClassName="overflow-visible"
        baseTransform="translate(-50%, -50%)"
        onClose={onClose}
      >
        <div className="bg-black p-2 leading-none">
          <Minesweeper
            embedded
            defaultDifficulty="Beginner"
            onClose={onClose}
          />
        </div>
      </StrangeOsDialog>
    </div>
  );
}
