import { renderToStaticMarkup } from "react-dom/server";
import { getBytes, ref } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase";
import { LabelArtwork } from "./LabelArtwork";
import { PRINT_PPI, printPixelSize } from "./print-resolution";
import { setPngResolution } from "./png-resolution";
import {
  listFontVariants,
  loadFontVariant,
  type FontCatalogItem,
  type FontVariant,
} from "./font-catalog-repository";
import {
  safeFilename,
  type LabelDesign,
  type LabelLayer,
  type LabelSide,
} from "./design-configurator-model";

export type ResolvedLabelFont = { family: string; variant: FontVariant };
export const fontKey = (layer: Pick<LabelLayer, "fontId" | "variantId">) =>
  `${layer.fontId ?? "default"}:${layer.variantId ?? "preview"}`;
const fontPromises = new Map<string, Promise<ResolvedLabelFont>>();
export function resolveLabelFont(font: FontCatalogItem, variantId?: string) {
  const key = fontKey({ fontId: font.id, variantId });
  let pending = fontPromises.get(key);
  if (!pending) {
    pending = (async () => {
      const variants = await listFontVariants(font);
      const variant = variantId
        ? variants.find((v) => v.id === variantId)
        : (variants.find((v) => v.storagePath === font.preview?.storagePath) ??
          variants[0]);
      if (!variant) throw Error(`No se encontró la variante de ${font.name}.`);
      const loaded = await loadFontVariant(font, variant);
      return { family: loaded.familyName, variant };
    })();
    fontPromises.set(key, pending);
    pending.catch(() => fontPromises.delete(key));
  }
  return pending;
}
export function defaultLabelFont(layer: LabelLayer) {
  return layer.id === "title" ? "Berlin Type Office" : "Alte DIN Input";
}
export function downloadDesignFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function base64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export async function createLabelSvg(
  design: LabelDesign,
  side: LabelSide,
  fonts: FontCatalogItem[],
  includeBleed: boolean,
) {
  const resolved = new Map<string, ResolvedLabelFont>();
  for (const layer of design[side].filter(
    (l) => l.visible && l.kind !== "image" && l.fontId,
  )) {
    const font = fonts.find((f) => f.id === layer.fontId);
    if (!font)
      throw Error(
        `La fuente de «${layer.name}» no está disponible. Elegí otra antes de exportar.`,
      );
    resolved.set(fontKey(layer), await resolveLabelFont(font, layer.variantId));
  }
  await document.fonts.ready;
  const rules: string[] = [];
  const defaults = [
    {
      family: "Alte DIN Input",
      url: "/media/fonts/Alte%20DIN%201451%20Mittelschrift%20gepraegt%20Regular.ttf",
      format: "truetype",
    },
    {
      family: "Berlin Type Office",
      url: "/media/fonts/BerlinType-Bold.otf",
      format: "opentype",
    },
  ];
  for (const font of defaults) {
    const response = await fetch(font.url);
    if (!response.ok)
      throw Error(
        "No se pudo incluir una fuente de interfaz en la exportación.",
      );
    rules.push(
      `@font-face{font-family:${JSON.stringify(font.family)};src:url(data:font/${font.format === "truetype" ? "ttf" : "otf"};base64,${base64(new Uint8Array(await response.arrayBuffer()))}) format('${font.format}');font-weight:400;}`,
    );
  }
  const embedded = new Set<string>();
  for (const item of resolved.values()) {
    if (embedded.has(item.family)) continue;
    embedded.add(item.family);
    const bytes = new Uint8Array(
      await getBytes(
        ref(firebaseStorage, item.variant.storagePath),
        20 * 1024 * 1024,
      ),
    );
    const format = (
      {
        otf: "opentype",
        ttf: "truetype",
        woff: "woff",
        woff2: "woff2",
      } as Record<string, string>
    )[item.variant.extension];
    if (!format) throw Error("Formato de fuente no exportable.");
    rules.push(
      `@font-face{font-family:${JSON.stringify(item.family)};src:url(data:font/${item.variant.extension};base64,${base64(bytes)}) format('${format}');font-weight:400;}`,
    );
  }
  const markup = renderToStaticMarkup(
    <LabelArtwork
      design={design}
      side={side}
      prefix="label-export"
      bleed={includeBleed}
      fontFamily={(layer) =>
        resolved.get(fontKey(layer))?.family ?? defaultLabelFont(layer)
      }
    />,
  );
  // DOM serialization avoids injecting user content into SVG markup or CSS.
  const svg = new DOMParser().parseFromString(
    markup,
    "image/svg+xml",
  ).documentElement;
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = rules.join("\n");
  svg.querySelector("defs")?.prepend(style);
  svg.removeAttribute("class");
  return new XMLSerializer().serializeToString(svg);
}
export async function exportLabelPng(svg: string, millimeters: number) {
  const source = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml" }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(Error("No se pudo renderizar el PNG."));
      image.src = source;
    });
    const pixels = printPixelSize(millimeters),
      canvas = document.createElement("canvas");
    canvas.width = pixels;
    canvas.height = pixels;
    const context = canvas.getContext("2d");
    if (!context) throw Error("No se pudo crear el PNG.");
    context.drawImage(image, 0, 0, pixels, pixels);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(Error("No se pudo crear el PNG.")),
        "image/png",
      ),
    );
    return new Blob([setPngResolution(new Uint8Array(await png.arrayBuffer()), PRINT_PPI)], { type: "image/png" });
  } finally {
    URL.revokeObjectURL(source);
  }
}
export function printLabel(
  windowReference: Window,
  svg: string,
  millimeters: number,
) {
  const doc = windowReference.document;
  doc.title = "Vinyl label — print / save PDF";
  const style = doc.createElement("style");
  style.textContent = `@page{size:${millimeters}mm ${millimeters}mm;margin:0}html,body{margin:0;padding:0;background:white}svg{display:block;width:${millimeters}mm;height:${millimeters}mm}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}`;
  doc.head.append(style);
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  doc.body.replaceChildren(doc.importNode(parsed.documentElement, true));
  void doc.fonts.ready.then(() => {
    windowReference.focus();
    windowReference.print();
  });
}
export function labelExportName(
  design: LabelDesign,
  side: LabelSide,
  extension: string,
) {
  return `${safeFilename(design.title)}-side-${side.toLowerCase()}.${extension}`;
}
