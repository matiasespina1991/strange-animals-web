import { useEffect, useLayoutEffect, useRef } from "react";
import { Copy, LockKeyhole, LockKeyholeOpen } from "lucide-react";

export function LayerContextMenu({ x, y, count, targetSide, onCopy, onClose, locked, onToggleLock }: {
  x: number;
  y: number;
  count: number;
  targetSide: "A" | "B";
  onCopy: () => void;
  onClose: () => void;
  locked?: boolean;
  onToggleLock?: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = menu.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    node.style.left = `${Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8))}px`;
    node.style.top = `${Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8))}px`;
    node.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, [x, y]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Tab") {
        if (event.key === "Escape") event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    const scroll = (event: Event) => {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return;
      onClose();
    };
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);
  return (
    <div ref={menu} className="dc-layer-context-menu" role="menu" aria-label="Layer actions"
      style={{ left: x, top: y }} onContextMenu={event => event.preventDefault()}
      onKeyDown={event => event.stopPropagation()}>
      <small>{count} {count === 1 ? "layer" : "layers"} selected</small>
      {onToggleLock && <button type="button" role="menuitem" onClick={onToggleLock}>
        {locked ? <LockKeyholeOpen size={15} /> : <LockKeyhole size={15} />}
        {locked ? "Unlock position" : "Lock position"}
      </button>}
      <button type="button" role="menuitem" onClick={onCopy}>
        <Copy size={15} aria-hidden="true" /> Copy to {targetSide} side
      </button>
    </div>
  );
}
