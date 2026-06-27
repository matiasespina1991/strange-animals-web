import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type DialogSize = {
  height: number;
  width: number;
};

type StrangeOsDialogProperties = {
  baseTransform?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  defaultSize?: DialogSize;
  minSize?: DialogSize;
  onClose: () => void;
  onPointerLeave?: () => void;
  open: boolean;
  resizeAspectRatio?: number;
  resizeChromeHeight?: number;
  resizeKeepsTopLeft?: boolean;
  resizable?: boolean;
  title?: string;
  titleClassName?: string;
};

export function StrangeOsDialog({
  baseTransform,
  children,
  className = "",
  contentClassName = "",
  defaultSize,
  minSize = { height: 240, width: 320 },
  onClose,
  onPointerLeave,
  open,
  resizeAspectRatio,
  resizeChromeHeight = 0,
  resizeKeepsTopLeft = false,
  resizable = false,
  title,
}: StrangeOsDialogProperties) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState<DialogSize | null>(defaultSize ?? null);
  const dragReference = useRef<{
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startPositionX: number;
    startPositionY: number;
  } | null>(null);
  const resizeReference = useRef<{
    pointerId: number;
    startHeight: number;
    startPositionX: number;
    startPositionY: number;
    startHeight: number;
    startPointerX: number;
    startPointerY: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    setSize(defaultSize ?? null);
  }, [defaultSize, open]);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragReference.current;

      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      setPosition({
        x: drag.startPositionX + event.clientX - drag.startPointerX,
        y: drag.startPositionY + event.clientY - drag.startPointerY,
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = dragReference.current;

      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      dragReference.current = null;
      setDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragging]);

  useEffect(() => {
    if (!resizing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const currentResize = resizeReference.current;

      if (!currentResize || event.pointerId !== currentResize.pointerId) {
        return;
      }

      const deltaX = event.clientX - currentResize.startPointerX;
      const deltaY = event.clientY - currentResize.startPointerY;
      const maxWidth = Math.max(window.innerWidth - 32, minSize.width);
      const maxHeight = Math.max(window.innerHeight - 32, minSize.height);

      let nextWidth = currentResize.startWidth + deltaX;
      let nextHeight = currentResize.startHeight + deltaY;

      if (resizeAspectRatio) {
        const startContentHeight =
          currentResize.startHeight - resizeChromeHeight;
        const minContentHeight = Math.max(
          1,
          minSize.height - resizeChromeHeight,
        );
        const maxContentHeight = Math.max(
          minContentHeight,
          maxHeight - resizeChromeHeight,
        );

        const widthDrivenByX = currentResize.startWidth + deltaX;
        const widthDrivenByY =
          currentResize.startWidth + deltaY * resizeAspectRatio;
        const useXAsDriver =
          Math.abs(deltaX / currentResize.startWidth) >=
          Math.abs(deltaY / Math.max(startContentHeight, 1));

        if (useXAsDriver) {
          nextWidth = widthDrivenByX;
          nextWidth = Math.min(maxWidth, Math.max(minSize.width, nextWidth));
          const nextContentHeight = nextWidth / resizeAspectRatio;
          nextHeight = resizeChromeHeight + nextContentHeight;
        } else {
          const nextContentHeight = Math.min(
            maxContentHeight,
            Math.max(minContentHeight, startContentHeight + deltaY),
          );
          nextHeight = resizeChromeHeight + nextContentHeight;
          nextWidth = nextContentHeight * resizeAspectRatio;
        }

        if (nextHeight > maxHeight) {
          nextHeight = maxHeight;
          nextWidth = (nextHeight - resizeChromeHeight) * resizeAspectRatio;
        }

        if (nextWidth > maxWidth) {
          nextWidth = maxWidth;
          nextHeight = resizeChromeHeight + nextWidth / resizeAspectRatio;
        }

        nextWidth = Math.max(minSize.width, nextWidth);
        nextHeight = Math.max(minSize.height, nextHeight);
      } else {
        nextWidth = Math.min(maxWidth, Math.max(minSize.width, nextWidth));
        nextHeight = Math.min(maxHeight, Math.max(minSize.height, nextHeight));
      }

      setSize({
        width: nextWidth,
        height: nextHeight,
      });

      if (resizeKeepsTopLeft) {
        setPosition({
          x:
            currentResize.startPositionX +
            (nextWidth - currentResize.startWidth) / 2,
          y:
            currentResize.startPositionY +
            (nextHeight - currentResize.startHeight) / 2,
        });
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const currentResize = resizeReference.current;

      if (!currentResize || event.pointerId !== currentResize.pointerId) {
        return;
      }

      resizeReference.current = null;
      setResizing(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [minSize.height, minSize.width, resizing]);

  return (
    <AnimatePresence>
      {open && (
        <div
          data-strange-os-dialog
          data-custom-cursor
          className={[
            "pointer-events-auto fixed w-[min(17.6rem,calc(100vw-2rem))]",
            className,
          ].join(" ")}
          style={{
            transform: [
              baseTransform,
              `translate(${position.x}px, ${position.y}px)`,
            ]
              .filter(Boolean)
              .join(" "),
          }}
          onPointerLeave={onPointerLeave}
        >
          <motion.section
            animate={{ opacity: 1, scale: 1 }}
            className={[
              "relative flex flex-col border-[0.75px] border-white/80 bg-black tracking-[0.01em] text-white/90 text-[0.85rem]",
              contentClassName,
            ].join(" ")}
            style={{
              fontFamily: '"AMI EGA 8x14", Ubuntu Sans Mono, monospace',
              letterSpacing: "0.01em",
              height: size?.height,
              width: size?.width,
            }}
            exit={{ opacity: 0, scale: 0.96 }}
            initial={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <header
              className={[
                "flex min-h-8 select-none items-center justify-between border-b-[0.75px] border-white/80 bg-black px-2.5 py-1.5 text-white/90",
                dragging ? "cursor-grabbing" : "cursor-grab",
              ].join(" ")}
              onPointerDown={(event) => {
                if (event.button !== 0) {
                  return;
                }
                dragReference.current = {
                  pointerId: event.pointerId,
                  startPointerX: event.clientX,
                  startPointerY: event.clientY,
                  startPositionX: position.x,
                  startPositionY: position.y,
                };
                setDragging(true);
              }}
            >
              {title ? (
                <h2 className={"text-[0.85rem] uppercase tracking-[0.01em]"}>
                  {title}
                </h2>
              ) : (
                <div aria-hidden="true" />
              )}
              <button
                type="button"
                aria-label="Close dialog"
                className="flex h-6 w-6 shrink-0 items-center justify-center border-[0.75px] border-white/80 bg-black text-[0.85rem] tracking-normal leading-none font-normal text-white/90 hover:bg-white/20"
                style={{
                  fontFamily:
                    '"AMI EGA 8x14", Ubuntu Sans Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontWeight: 400,
                  letterSpacing: "0",
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose();
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                ×
              </button>
            </header>
            {children}
            {resizing ? (
              <div
                aria-hidden="true"
                className="absolute inset-0 z-10"
                data-native-resize-cursor
              />
            ) : null}
            {resizable ? (
              <button
                type="button"
                aria-label="Resize dialog"
                className="absolute bottom-0 right-0 z-20 h-5 w-5 shrink-0 bg-transparent"
                data-native-resize-cursor
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  const nextSize = size ?? defaultSize;

                  if (!nextSize) {
                    return;
                  }

                  resizeReference.current = {
                    pointerId: event.pointerId,
                    startPositionX: position.x,
                    startPositionY: position.y,
                    startWidth: nextSize.width,
                    startHeight: nextSize.height,
                    startPointerX: event.clientX,
                    startPointerY: event.clientY,
                  };
                  setResizing(true);
                }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-[3px] right-[3px] h-[9px] w-[9px] border-b border-r border-white/75"
                />
              </button>
            ) : null}
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
