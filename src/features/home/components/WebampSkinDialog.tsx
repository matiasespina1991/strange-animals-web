import { useEffect, useRef, useState } from "react";
import {
  listWebampSkins,
  type WebampSkin,
} from "@/features/webamp-skins/webamp-skin-repository";

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
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
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
        onPointerLeave={() => {
          const selectedSkin =
            skins.find((skin) => skin.id === selectedSkinId) ?? null;
          onPreview(selectedSkin);
        }}
      >
        <header
          className={[
            "flex select-none items-center justify-between border-b border-white bg-black px-2.5 py-1.5 text-white",
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
          <div className="webamp-skin-scrollbar max-h-[25vh] overflow-auto border border-white">
            {loading && (
              <p className="p-2 text-[0.625rem] uppercase">loading...</p>
            )}
            {!loading && skins.length === 0 && (
              <p className="p-2 text-[0.625rem] uppercase">no skins</p>
            )}
            {!loading &&
              skins.map((skin) => {
                const selected = skin.id === selectedSkinId;

                return (
                  <button
                    key={skin.id}
                    type="button"
                    className={[
                      "block w-full border-b border-white px-2 py-1 text-left text-[0.625rem] leading-tight tracking-[0.05em] last:border-b-0",
                      selected
                        ? "bg-white text-black"
                        : "bg-black text-white hover:bg-white hover:text-black",
                    ].join(" ")}
                    onClick={() => onSelect(skin)}
                    onDoubleClick={() => {
                      onSelect(skin);
                      onClose();
                    }}
                    onFocus={() => onPreview(skin)}
                    onMouseEnter={() => onPreview(skin)}
                  >
                    {skin.displayName}
                  </button>
                );
              })}
          </div>
        </div>
      </section>
    </div>
  );
}
