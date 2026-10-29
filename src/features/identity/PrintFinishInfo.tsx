import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

export function PrintFinishInfo() {
  const id = useId();
  const trigger = useRef<HTMLSpanElement>(null);
  const [popup, setPopup] = useState<{left: number; bottom: number; width: number; host: Element} | null>(null);
  const show = () => {
    const node = trigger.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    setPopup({left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      bottom: window.innerHeight - rect.top + 8, width,
      host: node.closest(".design-configurator") ?? document.body});
  };
  useEffect(() => {
    if (!popup) return;
    const hide = () => setPopup(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => { window.removeEventListener("scroll", hide, true); window.removeEventListener("resize", hide); };
  }, [popup]);
  return <>
    <span ref={trigger} className="dc-finish-info" tabIndex={0} aria-label="About print finish" aria-describedby={popup ? id : undefined}
      onMouseEnter={show} onMouseLeave={() => setPopup(null)} onFocus={show} onBlur={() => setPopup(null)}
      onKeyDown={event => { if (event.key === "Escape") setPopup(null); }}>
      <Info size={14} aria-hidden="true" />
    </span>
    {popup && createPortal(<span id={id} role="tooltip" className="dc-finish-tooltip"
      style={{left: popup.left, bottom: popup.bottom, width: popup.width}}>
      Choose how this part of your design will be printed. Ink Matte uses regular ink. Hot Foil Silver adds a shiny silver foil pressed onto the surface with heat. Raised Spot UV adds a clear, glossy varnish you can feel. Embossing raises the paper; Debossing presses it inward. Height and depth show an approximate result: confirm the finish and suitable paper with your printer before production.
    </span>, popup.host)}
  </>;
}
