import { useEffect, useId, useRef, useState } from "react";
import { Check } from "lucide-react";

type Props = { colors: readonly string[]; value?: string; label: string; onChoose: (color: string) => void };

export function ColorSwatches({ colors, value, label, onChoose }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>(".dc-color-popover button")?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
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
  const swatch = (color: string, popup = false) => {
    const selected = value?.toLowerCase() === color.toLowerCase();
    const rgb = color.replace("#", "");
    const light = parseInt(rgb.slice(0, 2), 16) * .299 + parseInt(rgb.slice(2, 4), 16) * .587 + parseInt(rgb.slice(4, 6), 16) * .114 > 140;
    return <button key={color} aria-label={`${label} ${color}`} aria-pressed={selected}
      style={{ backgroundColor: color, color: light ? "#20211e" : "#ffffff" }}
      onClick={() => { onChoose(color); if (popup) { setOpen(false); toggle.current?.focus(); } }}>
      {selected && <Check size={14} />}
    </button>;
  };
  return <div className="dc-color-swatches" ref={root}>
    <div className="dc-paper-options">{colors.slice(0, 4).map((color) => swatch(color))}</div>
    {colors.length > 4 && <button ref={toggle} className="dc-color-more" aria-label={`More ${label.toLowerCase()} options`}
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>+</button>}
    {open && colors.length > 4 && <div id={id} className="dc-color-popover" role="group" aria-label={label}>
      {colors.map((color) => swatch(color, true))}
    </div>}
  </div>;
}
