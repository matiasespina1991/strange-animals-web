import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { bringWindowToFront, useWindowZIndex } from "../hooks/useWindowStack";

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
  forceTopLayer?: boolean;
  headerActions?: ReactNode;
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
  windowId: string;
};

export function StrangeOsDialog({
  baseTransform,
  children,
  className = "",
  contentClassName = "",
  defaultSize,
  forceTopLayer = false,
  headerActions,
  minSize = { height: 240, width: 320 },
  onClose,
  onPointerLeave,
  open,
  resizeAspectRatio,
  resizeChromeHeight = 0,
  resizeKeepsTopLeft = true,
  resizable = false,
  title,
  titleClassName = "",
  windowId,
}: StrangeOsDialogProperties) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState<DialogSize | null>(defaultSize ?? null);
  const zIndex = useWindowZIndex(windowId, open);
  const resolvedZIndex = forceTopLayer ? zIndex + 300 : zIndex;
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
            zIndex: resolvedZIndex,
          }}
          onPointerDownCapture={() => {
            bringWindowToFront(windowId);
          }}
          onPointerLeave={onPointerLeave}
        >
          <motion.section
            animate={{
              opacity: 1,
              scale: 1,
              transition: { delay: 0.5, duration: 0.16, ease: "easeOut" },
            }}
            className={[
              "relative flex flex-col border border-[#d1d1d1cc] bg-black tracking-[0.01em] text-white/90 text-[0.85rem]",
              contentClassName,
            ].join(" ")}
            style={{
              fontFamily: '"AMI EGA 8x14", Ubuntu Sans Mono, monospace',
              letterSpacing: "0.01em",
              height: size?.height,
              width: size?.width,
            }}
            exit={{
              opacity: 0,
              scale: 0.96,
              transition: { duration: 0.16, ease: "easeOut" },
            }}
            initial={{ opacity: 0, scale: 0.96 }}
          >
            <header
              className={[
                "flex min-h-7 select-none items-center justify-between border-b border-[#d1d1d1cc] bg-black py-1 pl-2.5 pr-1 text-white/90",
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
              <div
                className="flex min-w-0 flex-1 items-center gap-2               justify-between
              pr-2"
              >
                {title ? (
                  <h2
                    className={[
                      "truncate text-[0.85rem] uppercase tracking-[0.01em]",
                      titleClassName,
                    ].join(" ")}
                  >
                    {title}
                  </h2>
                ) : (
                  <div aria-hidden="true" />
                )}
                {headerActions}
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                className="relative flex h-5 w-5 shrink-0 items-center justify-center border border-[#d1d1d1cc] bg-black text-white/90 shadow-[1px_1px_0_0_rgba(255,255,255,0.78)] transition-[transform,box-shadow] duration-100 ease-out hover:translate-x-px hover:translate-y-px hover:shadow-[0_0_0_0_rgba(255,255,255,0)] active:translate-x-px active:translate-y-px active:shadow-[0_0_0_0_rgba(255,255,255,0)]"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose();
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 h-[2px] w-[0.62rem] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current"
                />
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 h-[2px] w-[0.62rem] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-current"
                />
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
                  className="pointer-events-none absolute bottom-[3px] right-[3px] h-[9px] w-[9px] border-b border-r border-[#d1d1d1cc]"
                />
              </button>
            ) : null}
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
