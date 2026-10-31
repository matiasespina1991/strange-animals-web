import { useLayoutEffect, useRef } from "react";
import type { LabelLayer } from "./design-configurator-model";

/** The textarea owns focus; this mirrors its insertion point in SVG coordinates. */
export function CanvasTextCaret({layer, offset}: {layer: LabelLayer; offset: number}) {
  const ref = useRef<SVGLineElement>(null);
  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      const line = ref.current;
      const parent = line?.parentElement;
      if (!active || !line || !parent) return;
      const texts = [...parent.querySelectorAll("text")];
      const text = texts.at(-1);
      if (!text) return;
      try {
        const count = text.getNumberOfChars();
        if (!count) return;
        const before = layer.text.slice(0, offset);
        const lines = before.split("\n");
        // SVG tspans omit newlines, but empty rows contain a NBSP placeholder.
        const index = layer.kind === "circular" ? before.length :
          lines.slice(0, -1).reduce((sum, value) => sum + Math.max(1, value.length), 0) + lines.at(-1)!.length;
        const next = Math.min(index, count - 1);
        const atEnd = index >= count;
        const point = atEnd ? text.getEndPositionOfChar(count - 1) : text.getStartPositionOfChar(next);
        const rotation = text.getRotationOfChar(next);
        const matrix = text.getCTM();
        const parentMatrix = (parent as unknown as SVGGElement).getCTM();
        if (!matrix || !parentMatrix) return;
        const relative = parentMatrix.inverse().multiply(matrix);
        line.setAttribute("transform", `matrix(${relative.a} ${relative.b} ${relative.c} ${relative.d} ${relative.e} ${relative.f}) translate(${point.x} ${point.y}) rotate(${rotation})`);
        line.setAttribute("y1", String(-layer.size * .85));
        line.setAttribute("y2", String(layer.size * .15));
        line.style.visibility = "visible";
      } catch {
        line.style.visibility = "hidden";
      }
    };
    measure();
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => { active = false; document.fonts.removeEventListener("loadingdone", measure); };
  }, [layer, offset]);
  return <line ref={ref} x1={0} x2={0} className="dc-text-caret" aria-hidden="true" style={{visibility:"hidden"}} />;
}
