import * as opentype from "opentype.js";
import type { Font } from "opentype.js";
import type { BezierPath } from "ag-psd";
import { psdPaths } from "./psd-vector-paths";

export function embeddedOutlineFonts(svg: SVGSVGElement): Map<string, Font> {
  const fonts = new Map<string, Font>();
  const css = svg.querySelector("style")?.textContent ?? "";
  const pattern = /font-family:("(?:\\.|[^"\\])*");src:url\(data:font\/[^;]+;base64,([A-Za-z0-9+/=]+)\)/g;
  for (const match of css.matchAll(pattern)) {
    const family = JSON.parse(match[1]) as string;
    const binary = atob(match[2]);
    const buffer = Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
    try { fonts.set(family, opentype.parse(buffer)); }
    catch (error) {
      console.warn("[DesignConfigurator/psd] Font decoding failed", { family, byteLength: buffer.byteLength }, error);
      // Only reject the export if this font is actually used by a text layer.
    }
  }
  return fonts;
}

/** Let SVG perform baseline/textPath layout, then replace each glyph with outlines. */
export function outlineText(text: SVGTextElement, font: Font, scale: number, extra: number): BezierPath[] {
  const paths: BezierPath[] = [];
  const parent = text.parentElement!;
  const fragment = document.createElementNS("http://www.w3.org/2000/svg", "g");
  fragment.setAttribute("fill", text.getAttribute("fill") ?? "#000000");
  const filter = text.getAttribute("filter");
  if (filter) fragment.setAttribute("filter", filter);
  const rotation = parent.getAttribute("transform")?.match(/rotate\(([-\d.]+) ([-\d.]+) ([-\d.]+)\)/);
  const angle = Number(rotation?.[1] ?? 0) * Math.PI / 180;
  const cx = Number(rotation?.[2] ?? 0), cy = Number(rotation?.[3] ?? 0);
  const chars = Array.from(text.textContent ?? "");
  let offset = 0;
  for (const char of chars) {
    const position = text.getStartPositionOfChar(offset);
    const glyphAngle = text.getRotationOfChar(offset);
    offset += char.length;
    const glyph = font.charToGlyph(char);
    if (!glyph.index && char.trim()) throw new Error(`Cannot outline glyph “${char}”. Choose another font for PSD export.`);
    const path = glyph.getPath(0, 0, Number(text.getAttribute("font-size")));
    const a = glyphAngle * Math.PI / 180;
    paths.push(...psdPaths(path.commands, (x, y) => {
      const px = position.x + x * Math.cos(a) - y * Math.sin(a);
      const py = position.y + x * Math.sin(a) + y * Math.cos(a);
      return [((px - cx) * Math.cos(angle) - (py - cy) * Math.sin(angle) + cx + extra) * scale,
        ((px - cx) * Math.sin(angle) + (py - cy) * Math.cos(angle) + cy + extra) * scale];
    }));
    const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
    node.setAttribute("d", path.toPathData(4));
    node.setAttribute("transform", `translate(${position.x} ${position.y}) rotate(${glyphAngle})`);
    fragment.append(node);
  }
  text.replaceWith(fragment);
  return paths;
}
