import {StrangeOsDialog} from './StrangeOsDialog';

const jspaintPagePath = '/apps/jspaint/index.html';

type JspaintDialogProperties = {
  onClose: () => void;
  open: boolean;
};

export function JspaintDialog({onClose, open}: JspaintDialogProperties) {
  const hideCustomCursor = () => {
    window.dispatchEvent(new CustomEvent('strangeanimals-cursor-hide'));
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[92]">
      <StrangeOsDialog
        key={open ? 'jspaint-open' : 'jspaint-closed'}
        open={open}
        title="PAINT.EXE"
        className="left-1/2 top-1/2 !w-auto max-w-[calc(100vw-2rem)]"
        contentClassName="overflow-hidden"
        baseTransform="translate(-50%, -50%)"
        defaultSize={{width: 745, height: 518}}
        minSize={{width: 480, height: 360}}
        onClose={onClose}
        resizable
      >
        <div
          className="min-h-0 flex-1 bg-black leading-none"
          data-native-cursor-surface
          onPointerEnter={hideCustomCursor}
        >
          <iframe
            className="block h-full min-h-0 w-full border-0 bg-black"
            src={jspaintPagePath}
            title="JS Paint"
          />
        </div>
      </StrangeOsDialog>
    </div>
  );
}
