import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronsRight } from "lucide-react";

/** Secondary toolbar options stay inline on wide screens and in overflow below 1600px. */
export function SleeveToolbar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!open || !trigger.current || !panel.current) return;
    const bounds = trigger.current.getBoundingClientRect();
    const width = panel.current.offsetWidth;
    panel.current.style.left = `${Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12))}px`;
    panel.current.style.top = `${bounds.bottom + 8}px`;
    panel.current.querySelector<HTMLElement>("input,button")?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const resize = () => setOpen(false);
    const scroll = (event: Event) => {
      if (!(event.target instanceof Node) || !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", resize);
    document.addEventListener("scroll", scroll, true);
    return () => { document.removeEventListener("pointerdown", outside); window.removeEventListener("resize", resize); document.removeEventListener("scroll", scroll, true); };
  }, [open]);
  return <div className="dc-sleeve-overflow" ref={root} data-open={open} onKeyDown={(event) => {
    if (event.key === "Escape" && !root.current?.querySelector(".dc-color-popover")) {
      event.stopPropagation(); setOpen(false); trigger.current?.focus();
    }
  }}>
    <button className="dc-sleeve-overflow-trigger" ref={trigger} aria-label="Sleeve options" title="Sleeve options"
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><ChevronsRight size={14} /></button>
    <div className="dc-sleeve-overflow-panel" ref={panel} id={id} role="group" aria-label="Sleeve options">{children}</div>
  </div>;
}
