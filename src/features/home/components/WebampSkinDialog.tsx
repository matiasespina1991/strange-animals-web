import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValue } from "framer-motion";
import {
  listWebampSkins,
  type WebampSkin,
} from "@/features/webamp-skins/webamp-skin-repository";
import { StrangeOsDialog } from "./StrangeOsDialog";

const getInitialListHeight = () => {
  const rootFontSize = Number.parseFloat(
    window.getComputedStyle(document.documentElement).fontSize,
  );

  return Math.round(window.innerHeight * 0.25 + rootFontSize * 5);
};

const hoverPreviewDelayMs = 550;
const scrollbarRailWidth = 8.4;

const formatSkinDisplayName = (displayName: string) =>
  displayName.replaceAll("_", " ");

type ScrollMetrics = {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
};

type WebampSkinDialogProperties = {
  open: boolean;
  selectedSkinId: string | null;
  onClose: () => void;
  onPreview: (skin: WebampSkin | null) => void;
  onSelect: (skin: WebampSkin | null) => void;
};

export function WebampSkinDialog({
  open,
  selectedSkinId,
  onClose,
  onPreview,
  onSelect,
}: WebampSkinDialogProperties) {
  const [showStaffPicksOnly, setShowStaffPicksOnly] = useState(true);
  const [skins, setSkins] = useState<WebampSkin[]>([]);
  const [activeSkinId, setActiveSkinId] = useState<string | null>(null);
  const [hoveredSkinId, setHoveredSkinId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resizing, setResizing] = useState(false);
  const defaultListHeightReference = useRef(getInitialListHeight());
  const [listHeight, setListHeight] = useState(
    defaultListHeightReference.current,
  );
  const scrollbarThumbHeight = useMotionValue(18);
  const scrollbarThumbTop = useMotionValue(0);
  const skinButtonReferences = useRef(new Map<string, HTMLButtonElement>());
  const scrollContainerReference = useRef<HTMLDivElement>(null);
  const scrollMetricsReference = useRef<ScrollMetrics>({
    clientHeight: 1,
    scrollHeight: 1,
    scrollTop: 0,
  });
  const scrollbarDragReference = useRef<{
    pointerId: number;
    pointerOffsetY: number;
  } | null>(null);
  const hoverPreviewTimeoutReference = useRef<number | null>(null);
  const ignorePointerHoverReference = useRef(false);
  const selectedSkinIdReference = useRef<string | null>(selectedSkinId);
  const resizeReference = useRef<{
    pointerId: number;
    startPointerY: number;
    startHeight: number;
  } | null>(null);

  const clearHoverPreviewTimeout = () => {
    if (hoverPreviewTimeoutReference.current) {
      window.clearTimeout(hoverPreviewTimeoutReference.current);
      hoverPreviewTimeoutReference.current = null;
    }
  };

  const updateScrollMetrics = useCallback(() => {
    const scrollContainer = scrollContainerReference.current;

    if (!scrollContainer) {
      return;
    }

    const nextScrollMetrics = {
      clientHeight: scrollContainer.clientHeight,
      scrollHeight: scrollContainer.scrollHeight,
      scrollTop: scrollContainer.scrollTop,
    };
    const nextThumbMetrics = getScrollbarThumbMetrics(nextScrollMetrics);

    scrollMetricsReference.current = nextScrollMetrics;
    scrollbarThumbHeight.set(nextThumbMetrics.height);
    scrollbarThumbTop.set(nextThumbMetrics.top);
  }, [scrollbarThumbHeight, scrollbarThumbTop]);

  const scrollListFromScrollbarPointer = useCallback(
    (clientY: number, pointerOffsetY: number) => {
      const scrollContainer = scrollContainerReference.current;

      if (!scrollContainer) {
        return;
      }

      const track = scrollContainer.parentElement?.querySelector(
        "[data-webamp-skin-scrollbar-track]",
      );

      if (!(track instanceof HTMLElement)) {
        return;
      }

      const scrollMetrics = scrollMetricsReference.current;
      const scrollbarThumbMetrics = getScrollbarThumbMetrics(scrollMetrics);
      const trackRect = track.getBoundingClientRect();
      const nextThumbTop = Math.min(
        Math.max(clientY - trackRect.top - pointerOffsetY, 0),
        Math.max(scrollMetrics.clientHeight - scrollbarThumbMetrics.height, 0),
      );
      const scrollableDistance = Math.max(
        scrollMetrics.scrollHeight - scrollMetrics.clientHeight,
        0,
      );
      const thumbTravelDistance = Math.max(
        scrollMetrics.clientHeight - scrollbarThumbMetrics.height,
        1,
      );

      scrollContainer.scrollTop =
        (nextThumbTop / thumbTravelDistance) * scrollableDistance;
      updateScrollMetrics();
    },
    [updateScrollMetrics],
  );

  const scheduleHoverPreview = (skin: WebampSkin) => {
    clearHoverPreviewTimeout();
    hoverPreviewTimeoutReference.current = window.setTimeout(() => {
      setActiveSkinId(skin.id);
      onPreview(skin);
      hoverPreviewTimeoutReference.current = null;
    }, hoverPreviewDelayMs);
  };

  useEffect(() => {
    if (!open) {
      setLoaded(false);
      clearHoverPreviewTimeout();
      return;
    }

    let active = true;
    setLoaded(false);
    setLoading(true);

    listWebampSkins({ staffPicksOnly: showStaffPicksOnly })
      .then((nextSkins) => {
        if (active) {
          setSkins(nextSkins);
        }
      })
      .catch((error: unknown) => {
        console.warn("[webamp-skins] could not load skins", error);

        if (active) {
          setSkins([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoaded(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open, showStaffPicksOnly]);

  useEffect(() => clearHoverPreviewTimeout, []);

  useEffect(() => {
    window.requestAnimationFrame(updateScrollMetrics);
  }, [listHeight, loaded, skins.length, updateScrollMetrics]);

  useEffect(() => {
    selectedSkinIdReference.current = selectedSkinId;

    if (open) {
      setActiveSkinId(selectedSkinId);
    }
  }, [open, selectedSkinId]);

  useEffect(() => {
    if (!activeSkinId) {
      return;
    }

    skinButtonReferences.current.get(activeSkinId)?.scrollIntoView({
      block: "nearest",
    });
  }, [activeSkinId]);

  const restoreConfirmedSkin = () => {
    const confirmedSkinId = selectedSkinIdReference.current;
    const selectedSkin =
      skins.find((skin) => skin.id === confirmedSkinId) ?? null;

    setHoveredSkinId(null);
    setActiveSkinId(null);
    clearHoverPreviewTimeout();
    onPreview(selectedSkin);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const previewSkin = (skin: WebampSkin) => {
      setActiveSkinId(skin.id);
      onPreview(skin);
    };

    const moveActiveSkin = (direction: 1 | -1) => {
      if (skins.length === 0) {
        return;
      }

      const activeIndex = skins.findIndex((skin) => skin.id === activeSkinId);
      const selectedIndex = skins.findIndex(
        (skin) => skin.id === selectedSkinId,
      );
      const currentIndex = activeIndex === -1 ? selectedIndex : activeIndex;
      const nextIndex =
        currentIndex === -1
          ? direction > 0
            ? 0
            : skins.length - 1
          : Math.min(Math.max(currentIndex + direction, 0), skins.length - 1);

      previewSkin(skins[nextIndex]);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        clearHoverPreviewTimeout();
        ignorePointerHoverReference.current = true;
        setHoveredSkinId(null);
        moveActiveSkin(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        clearHoverPreviewTimeout();
        ignorePointerHoverReference.current = true;
        setHoveredSkinId(null);
        moveActiveSkin(-1);
        return;
      }

      if (event.key === "Enter") {
        const activeSkin = skins.find((skin) => skin.id === activeSkinId);

        if (!activeSkin) {
          return;
        }

        event.preventDefault();
        selectedSkinIdReference.current = activeSkin.id;
        onSelect(activeSkin);
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeSkinId, onClose, onPreview, onSelect, open, selectedSkinId, skins]);

  useEffect(() => {
    if (!resizing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const resize = resizeReference.current;

      if (!resize || event.pointerId !== resize.pointerId) {
        return;
      }

      const minimumHeight = defaultListHeightReference.current;
      const maximumHeight = Math.round(window.innerHeight * 0.65);
      const pointerDeltaY = event.clientY - resize.startPointerY;
      const nextHeight = Math.min(
        Math.max(resize.startHeight + pointerDeltaY, minimumHeight),
        maximumHeight,
      );

      setListHeight(nextHeight);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const resize = resizeReference.current;

      if (!resize || event.pointerId !== resize.pointerId) {
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
  }, [resizing]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = scrollbarDragReference.current;

      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      event.preventDefault();
      scrollListFromScrollbarPointer(event.clientY, drag.pointerOffsetY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = scrollbarDragReference.current;

      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      scrollbarDragReference.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [scrollListFromScrollbarPointer]);

  return (
    <StrangeOsDialog
      open={open && loaded}
      title="winamp skins"
      headerActions={
        <button
          type="button"
          role="checkbox"
          aria-checked={showStaffPicksOnly}
          className="inline-flex items-center gap-1.5 text-[0.62rem] normal-case tracking-[0.02em] text-white/78 hover:text-white"
          onClick={(event) => {
            event.stopPropagation();
            setShowStaffPicksOnly((currentValue) => !currentValue);
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <span
            aria-hidden="true"
            className="relative inline-flex h-[0.74rem] w-[0.74rem] shrink-0 items-center justify-center border border-[#d1d1d1cc] bg-black"
          >
            {showStaffPicksOnly ? (
              <span className="h-[2px] w-[6px] rotate-[-45deg] border-b-2 border-l-2 border-white" />
            ) : null}
          </span>
          <span> Only staff picks</span>
        </button>
      }
      windowId="winamp-skins"
      className="right-[3.75rem] top-1/2"
      baseTransform="translateY(-12rem)"
      onClose={onClose}
      onPointerLeave={restoreConfirmedSkin}
    >
      <div className="bg-black p-2">
        <div
          className="relative border border-[#d1d1d1cc]"
          style={{ height: listHeight }}
          onPointerLeave={restoreConfirmedSkin}
        >
          <div
            ref={scrollContainerReference}
            className="webamp-skin-scrollbar h-full overflow-y-scroll overflow-x-hidden"
            data-custom-scrollbar-content
            style={{ paddingRight: scrollbarRailWidth }}
            onScroll={updateScrollMetrics}
          >
            {loading && (
              <p className="p-2 text-[0.85rem] uppercase">loading...</p>
            )}
            {!loading && skins.length === 0 && (
              <p className="p-2 text-[0.85rem] uppercase">no skins</p>
            )}
            {!loading &&
              skins.map((skin) => {
                const active = skin.id === activeSkinId;
                const hovered = skin.id === hoveredSkinId;
                const selected = skin.id === selectedSkinId;

                return (
                  <button
                    key={skin.id}
                    ref={(node) => {
                      if (node) {
                        skinButtonReferences.current.set(skin.id, node);
                      } else {
                        skinButtonReferences.current.delete(skin.id);
                      }
                    }}
                    type="button"
                    data-active={active && !hoveredSkinId ? "true" : undefined}
                    data-hovered={hovered ? "true" : undefined}
                    data-selected={selected ? "true" : undefined}
                    className={[
                      "webamp-skin-tile block w-full max-w-full overflow-hidden break-words border-b border-[#d1d1d1cc] px-2 py-1 text-left text-[0.75rem] leading-tight tracking-[0.11em] whitespace-normal outline-none last:border-b-0",
                      selected ? "text-black" : "text-white/90",
                    ].join(" ")}
                    onClick={() => {
                      selectedSkinIdReference.current = skin.id;
                      setHoveredSkinId(null);
                      clearHoverPreviewTimeout();
                      setActiveSkinId(skin.id);
                      onSelect(skin);
                    }}
                    onDoubleClick={() => {
                      selectedSkinIdReference.current = skin.id;
                      setHoveredSkinId(null);
                      clearHoverPreviewTimeout();
                      setActiveSkinId(skin.id);
                      onSelect(skin);
                      onClose();
                    }}
                    onFocus={() => {
                      setActiveSkinId(skin.id);
                      onPreview(skin);
                    }}
                    onPointerMove={() => {
                      ignorePointerHoverReference.current = false;
                      if (hoveredSkinId === skin.id) {
                        return;
                      }

                      setHoveredSkinId(skin.id);
                      scheduleHoverPreview(skin);
                    }}
                    onMouseEnter={() => {
                      if (ignorePointerHoverReference.current) {
                        return;
                      }

                      setHoveredSkinId(skin.id);
                      scheduleHoverPreview(skin);
                    }}
                  >
                    {formatSkinDisplayName(skin.displayName)}
                  </button>
                );
              })}
          </div>
          <div
            aria-hidden="true"
            className="absolute bottom-0 right-0 top-0 border-l border-[#d1d1d1cc] bg-black"
            data-custom-cursor
            data-webamp-skin-scrollbar-track
            style={{ width: scrollbarRailWidth }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();

              const clickedThumb =
                event.target instanceof HTMLElement &&
                event.target.dataset.webampSkinScrollbarThumb === "true";
              const scrollbarThumbMetrics = getScrollbarThumbMetrics(
                scrollMetricsReference.current,
              );
              const pointerOffsetY = clickedThumb
                ? event.nativeEvent.offsetY
                : scrollbarThumbMetrics.height / 2;

              scrollbarDragReference.current = {
                pointerId: event.pointerId,
                pointerOffsetY,
              };
              scrollListFromScrollbarPointer(event.clientY, pointerOffsetY);
            }}
          >
            <motion.div
              className="absolute left-[-0.5px] right-[-0.5px] bg-white/90"
              data-webamp-skin-scrollbar-thumb="true"
              style={{
                height: scrollbarThumbHeight,
                top: scrollbarThumbTop,
              }}
            />
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        data-native-resize-cursor
        className="absolute bottom-0 right-0 size-5 cursor-nwse-resize bg-transparent"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();

          resizeReference.current = {
            pointerId: event.pointerId,
            startPointerY: event.clientY,
            startHeight: listHeight,
          };
          setResizing(true);
        }}
      >
        <span className="pointer-events-none absolute bottom-[3px] right-[3px] h-[8px] w-[8px] border-b border-r border-[#d1d1d1cc]" />
      </div>
    </StrangeOsDialog>
  );
}

function getScrollbarThumbMetrics({
  clientHeight,
  scrollHeight,
  scrollTop,
}: {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}) {
  const scrollableDistance = Math.max(scrollHeight - clientHeight, 1);
  const thumbHeight = Math.max(
    Math.round(
      (clientHeight / Math.max(scrollHeight, clientHeight)) * clientHeight,
    ),
    18,
  );
  const thumbTop = Math.round(
    (scrollTop / scrollableDistance) * Math.max(clientHeight - thumbHeight, 0),
  );

  return {
    height: thumbHeight,
    top: thumbTop,
  };
}
