import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const railWidth = 8.4;
const minimumThumbHeight = 18;

type RetroScrollbarProps = {
  children: ReactNode;
  className?: string;
};

type ScrollMetrics = {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
};

function getThumbMetrics({ clientHeight, scrollHeight, scrollTop }: ScrollMetrics) {
  const scrollableDistance = Math.max(scrollHeight - clientHeight, 1);
  const height = Math.max(
    Math.round(
      (clientHeight / Math.max(scrollHeight, clientHeight)) * clientHeight,
    ),
    minimumThumbHeight,
  );

  return {
    height,
    top: Math.round(
      (scrollTop / scrollableDistance) * Math.max(clientHeight - height, 0),
    ),
  };
}

export function RetroScrollbar({ children, className }: RetroScrollbarProps) {
  const scrollReference = useRef<HTMLDivElement>(null);
  const dragReference = useRef<{ pointerId: number; offsetY: number }>();
  const [thumb, setThumb] = useState({ height: minimumThumbHeight, top: 0 });

  const updateThumb = useCallback(() => {
    const container = scrollReference.current;

    if (!container) return;

    setThumb(
      getThumbMetrics({
        clientHeight: container.clientHeight,
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
      }),
    );
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(updateThumb);
  }, [children, updateThumb]);

  useEffect(() => {
    const container = scrollReference.current;

    if (!container || !("ResizeObserver" in window)) return;

    const observer = new ResizeObserver(updateThumb);
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateThumb]);

  const scrollFromPointer = (
    clientY: number,
    offsetY: number,
    track: HTMLElement,
  ) => {
    const container = scrollReference.current;

    if (!container) return;

    const trackRect = track.getBoundingClientRect();
    const metrics = {
      clientHeight: container.clientHeight,
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
    };
    const nextThumb = getThumbMetrics(metrics);
    const thumbTop = Math.min(
      Math.max(clientY - trackRect.top - offsetY, 0),
      Math.max(metrics.clientHeight - nextThumb.height, 0),
    );
    const thumbTravel = Math.max(metrics.clientHeight - nextThumb.height, 1);
    const scrollDistance = Math.max(metrics.scrollHeight - metrics.clientHeight, 0);

    container.scrollTop = (thumbTop / thumbTravel) * scrollDistance;
    updateThumb();
  };

  return (
    <div className="relative">
      <div
        ref={scrollReference}
        className={`retro-scrollbar-content overflow-y-scroll overflow-x-hidden ${className ?? ""}`}
        data-custom-scrollbar-content
        style={{ paddingRight: railWidth }}
        onScroll={updateThumb}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 bottom-0 border-x border-white/20 bg-black"
        data-custom-cursor
        onPointerDown={(event) => {
          event.preventDefault();
          const track = event.currentTarget;
          const clickedThumb = event.target instanceof HTMLElement && event.target.dataset.retroScrollbarThumb === "true";
          const offsetY = clickedThumb
            ? event.nativeEvent.offsetY
            : thumb.height / 2;

          track.setPointerCapture(event.pointerId);
          dragReference.current = { offsetY, pointerId: event.pointerId };
          scrollFromPointer(event.clientY, offsetY, track);
        }}
        onPointerMove={(event) => {
          const drag = dragReference.current;

          if (!drag || drag.pointerId !== event.pointerId) return;

          scrollFromPointer(event.clientY, drag.offsetY, event.currentTarget);
        }}
        onPointerUp={(event) => {
          if (dragReference.current?.pointerId === event.pointerId) {
            dragReference.current = undefined;
          }
        }}
        onPointerCancel={() => {
          dragReference.current = undefined;
        }}
        style={{ width: railWidth }}
      >
        <span
          className="absolute left-[-0.5px] right-[-0.5px] bg-white/90"
          data-retro-scrollbar-thumb="true"
          style={{ height: thumb.height, top: thumb.top }}
        />
      </div>
    </div>
  );
}
