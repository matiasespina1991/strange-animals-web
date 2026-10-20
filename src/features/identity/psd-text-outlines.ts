import * as opentype from "opentype.js";
import type { Font } from "opentype.js";
import type { BezierPath } from "ag-psd";
import { psdPaths } from "./psd-vector-paths";
import { outlineGlyph, type OutlineFallback } from "./psd-glyph-fallback";

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
export function outlineText(text: SVGTextElement, font: Font, scale: number, { extra = 0, fallbacks = [] }: { extra?: number; fallbacks?: readonly OutlineFallback[] } = {}): BezierPath[] {
  const paths: BezierPath[] = [];
  const parent = text.parentElement!;
  const fragment = document.createElementNS("http://www.w3.org/2000/svg", "g");
  fragment.setAttribute("fill", text.getAttribute("fill") ?? "#000000");
  const filter = text.getAttribute("filter");
  if (filter) fragment.setAttribute("filter", filter);
  const rotation = parent.getAttribute("transform")?.match(/rotate\(([-\d.]+) ([-\d.]+) ([-\d.]+)\)/);
  const angle = Number(rotation?.[1] ?? 0) * Math.PI / 180;
  const cx = Number(rotation?.[2] ?? 0), cy = Number(rotation?.[3] ?? 0);
  const raw = text.textContent ?? "";
  const renderedCount = text.getNumberOfChars();
  const spans = Array.from(text.querySelectorAll("tspan, textPath"));
  const collapsed = (spans.length ? spans : [text]).map((span) =>
    (span.textContent ?? "").replace(/[\t\n\r ]+/g, " ").replace(/^ | $/g, ""),
  ).join("");
  // SVG indexes address rendered characters, not raw textContent whitespace.
  // Keep preformatted text intact when the browser reports all raw characters.
  const content = raw.length === renderedCount ? raw : collapsed;
  const chars = Array.from(content);
  const utf16Indices = content.length === renderedCount;
  if (!utf16Indices && chars.length !== renderedCount) {
    console.error("[DesignConfigurator/psd] SVG character mapping mismatch", {
      layerId: parent.getAttribute("data-layer-id"), rawLength: raw.length,
      normalizedLength: content.length, renderedCount,
    });
    throw new Error("Could not map SVG characters for PSD outlines. See the export log for layer details.");
  }
  let offset = 0;
  for (const char of chars) {
    const position = text.getStartPositionOfChar(offset);
    const glyphAngle = text.getRotationOfChar(offset);
    offset += utf16Indices ? char.length : 1;
    const { glyph, fallbackFamily } = outlineGlyph(font, char, fallbacks);
    if (fallbackFamily) console.warn("[DesignConfigurator/psd] Default font used for missing glyph", {
      layerId: parent.getAttribute("data-layer-id"), codePoint: `U+${char.codePointAt(0)!.toString(16).toUpperCase()}`, fallbackFamily,
    });
    if (!glyph.index && !char.trim()) continue;
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
