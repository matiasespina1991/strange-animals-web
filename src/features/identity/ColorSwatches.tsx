import { useEffect, useLayoutEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Plus } from "lucide-react";
import { colorSwatchCapacity } from "./color-swatch-capacity";

type Props = { colors: readonly string[]; value?: string; label: string; onChoose: (color: string) => void; onPreview?: (color: string | null) => void; visibleCount?: number; children?: ReactNode };

export function ColorSwatches({ colors, value, label, onChoose, onPreview, visibleCount = 3, children }: Props) {
  const preview = useRef(onPreview);
  preview.current = onPreview;
  useEffect(() => () => preview.current?.(null), []);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  const lastScroll = useRef(0);
  const [capacity, setCapacity] = useState<number | null>(null);
  const shownCount = Math.min(colors.length, capacity ?? visibleCount);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const style = getComputedStyle(element);
      if (style.getPropertyValue("--dc-auto-swatches").trim() !== "1" || !element.clientWidth) {
        setCapacity(null);
        return;
      }
      const options = element.querySelector<HTMLElement>(".dc-paper-options");
      const gap = options ? parseFloat(getComputedStyle(options).columnGap) || 0 : 7;
      const size = parseFloat(style.getPropertyValue("--dc-swatch-size")) || 22;
      const more = element.querySelector<HTMLElement>(".dc-color-more");
      setCapacity(colorSwatchCapacity(element.clientWidth, size, gap, more?.getBoundingClientRect().width || 26, parseFloat(style.columnGap) || 0, colors.length));
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : undefined;
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [colors.length, visibleCount]);
  useLayoutEffect(() => {
    if (!open) return;
    const palette = root.current?.querySelector<HTMLDivElement>(".dc-color-popover");
    if (!palette) return;
    const selected = palette.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    const target = selected ?? palette.querySelector<HTMLButtonElement>("button");
    target?.focus({ preventScroll: true });
    palette.scrollTop = lastScroll.current;
    if (selected) {
      const item = selected.getBoundingClientRect();
      const bounds = palette.getBoundingClientRect();
      palette.scrollTop += item.top - bounds.top - (palette.clientHeight - item.height) / 2;
    }
  }, [open, shownCount]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (root.current?.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);
  const swatch = (color: string) => {
    const selected = value?.toLowerCase() === color.toLowerCase();
    const rgb = color.replace("#", "");
    const light = parseInt(rgb.slice(0, 2), 16) * .299 + parseInt(rgb.slice(2, 4), 16) * .587 + parseInt(rgb.slice(4, 6), 16) * .114 > 140;
    return <button type="button" key={color} title={color.toUpperCase()} aria-label={`${label} ${color}`} aria-pressed={selected}
      style={{ backgroundColor: color, color: light ? "#20211e" : "#ffffff" }}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") onPreview?.(color); }}
      onPointerLeave={() => onPreview?.(null)}
      onClick={() => { onPreview?.(null); onChoose(color); }}>
      {selected && <Check size={14} />}
    </button>;
  };
  return <div className="dc-color-swatches" ref={root}>
    <div className="dc-paper-options">{colors.slice(0, shownCount).map((color) => swatch(color))}</div>
    {colors.length > shownCount && <button type="button" ref={toggle} className="dc-color-more" aria-label={`More ${label.toLowerCase()} options`}
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><Plus size={18} strokeWidth={3} aria-hidden="true" /></button>}
    {open && colors.length > shownCount && <div id={id} className="dc-color-popover" role="group" aria-label={label}
      onScroll={(event) => { lastScroll.current = event.currentTarget.scrollTop; }}>
      {colors.slice(shownCount).map((color) => swatch(color))}
    </div>}
    {children}
  </div>;
}
