import { useLayoutEffect, useRef } from "react";

/** Measures the sibling SVG text in its local coordinates, before layer rotation. */
export function TextSelectionGuide({ revision }: { revision: string }) {
  const rect = useRef<SVGRectElement>(null);
  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      const guide = rect.current;
      const text = guide?.parentElement?.querySelector("text");
      if (!active || !guide || !text) return;
      const bounds = text.getBBox();
      const padding = 6;
      guide.setAttribute("x", String(bounds.x - padding));
      guide.setAttribute("y", String(bounds.y - padding));
      guide.setAttribute("width", String(bounds.width + padding * 2));
      guide.setAttribute("height", String(bounds.height + padding * 2));
    };
    measure();
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => {
      active = false;
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [revision]);
  return <rect ref={rect} className="dc-selection-guide" />;
}
