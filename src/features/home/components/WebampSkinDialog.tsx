import {useEffect, useRef, useState} from 'react';
import {
  listWebampSkins,
  type WebampSkin,
} from '@/features/webamp-skins/webamp-skin-repository';

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
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [position, setPosition] = useState({x: 0, y: 0});
  const [listHeight, setListHeight] = useState(() =>
    Math.round(window.innerHeight * 0.25),
  );
  const skinButtonReferences = useRef(new Map<string, HTMLButtonElement>());
  const selectedSkinIdReference = useRef<string | null>(selectedSkinId);
  const resizeReference = useRef<{
    pointerId: number;
    startPointerY: number;
    startHeight: number;
  } | null>(null);
  const dragReference = useRef<{
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startPositionX: number;
    startPositionY: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    setLoading(true);

    listWebampSkins()
      .then((nextSkins) => {
        if (active) {
          setSkins(nextSkins);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open]);

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

    setActiveSkinId(selectedSkin?.id ?? null);
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
      const selectedIndex = skins.findIndex((skin) => skin.id === selectedSkinId);
      const currentIndex = activeIndex >= 0 ? activeIndex : selectedIndex;
      const nextIndex =
        currentIndex >= 0
          ? Math.min(Math.max(currentIndex + direction, 0), skins.length - 1)
          : direction > 0
            ? 0
            : skins.length - 1;

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
        moveActiveSkin(1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
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

      const minimumHeight = 120;
      const maximumHeight = Math.round(window.innerHeight * 0.65);
      const nextHeight = resize.startHeight + resize.startPointerY - event.clientY;

      setListHeight(Math.min(Math.max(nextHeight, minimumHeight), maximumHeight));
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

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragging]);

  if (!open) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <section
        className="pointer-events-auto fixed bottom-7 right-7 w-[min(22rem,calc(100vw-2rem))] border border-white bg-black font-mono text-white"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
        onPointerLeave={restoreConfirmedSkin}
      >
        <header
          className={[
            'flex select-none items-center justify-between border-b border-white bg-black px-2.5 py-1.5 text-white',
            dragging ? 'cursor-grabbing' : 'cursor-grab',
          ].join(' ')}
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
          <h2 className="text-[0.60rem] uppercase tracking-[0.14em]">
            winamp skins
          </h2>
          <button
            type="button"
            aria-label="Close skins dialog"
            className="flex size-5 cursor-pointer items-center justify-center border border-white bg-black text-[0.75rem] font-bold leading-none text-white hover:bg-white hover:text-black"
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
        <div className="bg-black p-2">
          <div
            className="webamp-skin-scrollbar overflow-auto border border-white"
            style={{height: listHeight}}
            onPointerLeave={restoreConfirmedSkin}
          >
            {loading && (
              <p className="p-2 text-[0.625rem] uppercase">loading...</p>
            )}
            {!loading && skins.length === 0 && (
              <p className="p-2 text-[0.625rem] uppercase">no skins</p>
            )}
            {!loading &&
              skins.map((skin) => {
                const highlighted = skin.id === (activeSkinId ?? selectedSkinId);

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
                      'block w-full border-b border-white px-2 py-1 text-left text-[0.625rem] leading-tight tracking-[0.05em] last:border-b-0',
                      highlighted
                        ? 'bg-white text-black'
                        : 'bg-black text-white hover:bg-white hover:text-black',
                    ].join(' ')}
                    onClick={() => {
                      selectedSkinIdReference.current = skin.id;
                      setActiveSkinId(skin.id);
                      onSelect(skin);
                    }}
                    onDoubleClick={() => {
                      selectedSkinIdReference.current = skin.id;
                      setActiveSkinId(skin.id);
                      onSelect(skin);
                      onClose();
                    }}
                    onFocus={() => {
                      setActiveSkinId(skin.id);
                      onPreview(skin);
                    }}
                    onMouseEnter={() => {
                      setActiveSkinId(skin.id);
                      onPreview(skin);
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
          className="absolute bottom-0 right-0 size-3 cursor-nwse-resize border-b border-r border-white bg-black"
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
      </section>
    </div>
  );
}
