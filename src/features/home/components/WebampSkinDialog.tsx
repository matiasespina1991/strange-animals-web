import {useEffect, useRef, useState} from 'react';
import {
  listWebampSkins,
  type WebampSkin,
} from '@/features/webamp-skins/webamp-skin-repository';
import {StrangeOsDialog} from './StrangeOsDialog';

const getInitialListHeight = () => {
  const rootFontSize = Number.parseFloat(
    window.getComputedStyle(document.documentElement).fontSize,
  );

  return Math.round(window.innerHeight * 0.25 + rootFontSize * 5);
};

const hoverPreviewDelayMs = 200;

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
  const skinButtonReferences = useRef(new Map<string, HTMLButtonElement>());
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

    listWebampSkins()
      .then((nextSkins) => {
        if (active) {
          setSkins(nextSkins);
        }
      })
      .catch((error: unknown) => {
        console.warn('[webamp-skins] could not load skins', error);

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
  }, [open]);

  useEffect(() => clearHoverPreviewTimeout, []);

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
      block: 'nearest',
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
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        clearHoverPreviewTimeout();
        ignorePointerHoverReference.current = true;
        setHoveredSkinId(null);
        moveActiveSkin(1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        clearHoverPreviewTimeout();
        ignorePointerHoverReference.current = true;
        setHoveredSkinId(null);
        moveActiveSkin(-1);
        return;
      }

      if (event.key === 'Enter') {
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

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [resizing]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <StrangeOsDialog
        open={open && loaded}
        title="winamp skins"
        titleClassName="italic"
        className="right-[3.75rem] top-1/2"
        baseTransform="translateY(-12rem)"
        onClose={onClose}
        onPointerLeave={restoreConfirmedSkin}
      >
        <div className="bg-black p-2">
          <div
            className="webamp-skin-scrollbar overflow-y-auto overflow-x-hidden border-[0.25px] border-white/90"
            style={{height: listHeight}}
            onPointerLeave={restoreConfirmedSkin}
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
                    className={[
                      'block w-full max-w-full overflow-hidden break-words border-b-[0.25px] border-white/90 px-2 py-1 text-left text-[0.75rem] leading-tight tracking-[0.11em] whitespace-normal outline-none last:border-b-0',
                      selected
                        ? 'bg-white/90 text-black'
                        : hovered
                          ? 'bg-white/25 text-white'
                          : 'bg-black text-white hover:bg-white/15',
                    ].join(' ')}
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
                    {skin.displayName}
                  </button>
                );
              })}
          </div>
        </div>
        <div
          aria-hidden="true"
          data-native-resize-cursor
          className="absolute bottom-0 right-0 size-3 cursor-nwse-resize border-b-[0.25px] border-r-[0.25px] border-white/90 bg-black"
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
        />
      </StrangeOsDialog>
    </div>
  );
}
