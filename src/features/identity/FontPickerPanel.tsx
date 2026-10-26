import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { fontPickerPanelLayout } from "./font-picker-panel-layout";
import "./font-picker-panel.css";

export const FONT_PICKER_MOBILE_QUERY = "(max-width: 800px)";
export function isMobileFontPicker() {
  return typeof window !== "undefined" && window.matchMedia(FONT_PICKER_MOBILE_QUERY).matches;
}

/** One catalog tree: desktop drawer or a mobile sheet above a live canvas. */
export function FontPickerPanel({ children, close, targetName }: {
  children: ReactNode; close: () => void; targetName: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onClose = useRef(close);
  onClose.current = close;
  const id = useId();
  const [mobile, setMobile] = useState(isMobileFontPicker);
  const [expanded, setExpanded] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const fullViewport = useRef({ width: typeof window === "undefined" ? 0 : window.innerWidth, height: typeof window === "undefined" ? 0 : window.innerHeight });
  useEffect(() => {
    const media = window.matchMedia(FONT_PICKER_MOBILE_QUERY);
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    if (!mobile) return;
    const editor = root.current?.closest<HTMLElement>(".design-configurator");
    if (!editor) return;
    const scroll = { x: window.scrollX, y: window.scrollY };
    const overflow = document.body.style.overflow;
    editor.classList.add("dc-font-picker-mobile-open");
    document.body.style.overflow = "hidden";
    return () => {
      editor.classList.remove("dc-font-picker-mobile-open");
      document.body.style.overflow = overflow;
      window.scrollTo(scroll.x, scroll.y);
    };
  }, [mobile]);

  useLayoutEffect(() => {
    if (!mobile) return;
    const editor = root.current?.closest<HTMLElement>(".design-configurator");
    if (!editor) return;
    const properties = ["--dc-font-viewport-height", "--dc-font-viewport-top", "--dc-font-sheet-height"];
    const previous = properties.map(property => editor.style.getPropertyValue(property));
    const update = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      if (window.innerWidth !== fullViewport.current.width) fullViewport.current = { width: window.innerWidth, height: window.innerHeight };
      else fullViewport.current.height = Math.max(fullViewport.current.height, window.innerHeight);
      const layout = fontPickerPanelLayout(height, fullViewport.current.height, expanded);
      editor.style.setProperty(properties[0], `${height}px`);
      editor.style.setProperty(properties[1], `${viewport?.offsetTop ?? 0}px`);
      editor.style.setProperty(properties[2], `${layout.sheetHeight}px`);
      editor.dataset.fontKeyboard = String(layout.compact);
      setKeyboard(layout.compact);
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      properties.forEach((property, i) => previous[i] ? editor.style.setProperty(property, previous[i]) : editor.style.removeProperty(property));
      delete editor.dataset.fontKeyboard;
    };
  }, [mobile, expanded]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Opening a mobile sheet must not summon the keyboard and hide the canvas.
    if (isMobileFontPicker()) closeButton.current?.focus({ preventScroll: true });
    else section.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        onClose.current();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return <div ref={root} className="dc-picker-overlay dc-picker-nonmodal dc-font-picker-panel" data-expanded={expanded} data-keyboard-open={keyboard}>
    <section ref={section} id={id} role="dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} className="dc-font-picker">
      <div className="dc-picker-heading">
        <div><h2 id={`${id}-title`}>Fonts</h2><p id={`${id}-description`} className="dc-font-picker-target">{targetName}</p></div>
        <div className="dc-font-picker-panel-actions">
          <button type="button" className="dc-font-sheet-size" aria-controls={id} aria-expanded={expanded}
            aria-label={expanded ? "Show more canvas" : "Show more fonts"} title={expanded ? "Show more canvas" : "Show more fonts"}
            onClick={() => setExpanded(current => !current)}>
            {expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
          <button ref={closeButton} type="button" aria-label="Close fonts" title="Close fonts" onClick={() => onClose.current()}><X size={20} /></button>
        </div>
      </div>
      {children}
    </section>
  </div>;
}
