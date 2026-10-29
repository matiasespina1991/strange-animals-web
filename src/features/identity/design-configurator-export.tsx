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
  getSurfaceLayers,
  safeFilename,
  SLEEVE_SIZE_MM,
  sleeveLabelGeometry,
  hasSleeveWindow,
  updateSurfaceLayers,
  textFoilColor,
  type LabelSurface,
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
  finishMode: "preview" | "flat" | "mask" | "base" | "height-mask" = "preview",
  cutCenter = true,
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
      finishMode={finishMode}
      cutCenter={cutCenter}
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

export async function createSleeveArtworkSvg(
  design: LabelDesign,
  fonts: FontCatalogItem[],
  side: LabelSide,
  finishMode: "preview" | "flat" | "mask" | "base" | "height-mask" = "preview",
) {
  const visibleLayers = getSurfaceLayers(design, "sleeve", side).filter(
    (layer) => layer.visible,
  );
  const resolved = new Map<string, ResolvedLabelFont>();
  for (const layer of visibleLayers) {
    if (layer.kind === "image" || !layer.fontId) continue;
    const font = fonts.find((item) => item.id === layer.fontId);
    if (!font) throw Error(`La fuente de «${layer.name}» no está disponible.`);
    resolved.set(fontKey(layer), await resolveLabelFont(font, layer.variantId));
  }

  const rules: string[] = [];
  const defaultFonts = [
    {
      family: "Alte DIN Input",
      url: "/media/fonts/Alte%20DIN%201451%20Mittelschrift%20gepraegt%20Regular.ttf",
      format: "truetype",
      extension: "ttf",
    },
    {
      family: "Berlin Type Office",
      url: "/media/fonts/BerlinType-Bold.otf",
      format: "opentype",
      extension: "otf",
    },
  ];
  for (const font of defaultFonts) {
    const response = await fetch(font.url);
    if (!response.ok)
      throw Error("No se pudo incluir una fuente de interfaz en la captura.");
    rules.push(
      `@font-face{font-family:${JSON.stringify(font.family)};src:url(data:font/${font.extension};base64,${base64(new Uint8Array(await response.arrayBuffer()))}) format('${font.format}');font-weight:400;}`,
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

  const svgNamespace = "http://www.w3.org/2000/svg";
  const root = document.createElementNS(svgNamespace, "svg");
  root.setAttribute("xmlns", svgNamespace);
  root.setAttribute("width", "600");
  root.setAttribute("height", "600");
  root.setAttribute("viewBox", "0 0 600 600");
  const defs = document.createElementNS(svgNamespace, "defs");
  const clip = document.createElementNS(svgNamespace, "clipPath");
  clip.setAttribute("id", "sleeve-texture-clip");
  const clipRect = document.createElementNS(svgNamespace, "rect");
  clipRect.setAttribute("width", "600");
  clipRect.setAttribute("height", "600");
  clip.append(clipRect);
  const cardboardMask = document.createElementNS(svgNamespace, "mask");
  cardboardMask.setAttribute("id", "sleeve-cardboard-mask");
  cardboardMask.setAttribute("maskUnits", "userSpaceOnUse");
  cardboardMask.setAttribute("maskContentUnits", "userSpaceOnUse");
  const cardboardArea = document.createElementNS(svgNamespace, "rect");
  cardboardArea.setAttribute("width", "600");
  cardboardArea.setAttribute("height", "600");
  cardboardArea.setAttribute("fill", "white");
  const cookieCutout = document.createElementNS(svgNamespace, "circle");
  const labelGeometry = sleeveLabelGeometry(design.diameterMm);
  cookieCutout.setAttribute("cx", String(labelGeometry.center));
  cookieCutout.setAttribute("cy", String(labelGeometry.center));
  cookieCutout.setAttribute("r", String(labelGeometry.radius));
  cookieCutout.setAttribute("fill", "black");
  cardboardMask.append(cardboardArea);
  if (hasSleeveWindow(design, side)) cardboardMask.append(cookieCutout);
  const style = document.createElementNS(svgNamespace, "style");
  style.textContent = rules.join("\n");
  defs.append(clip, cardboardMask, style);
  root.append(defs);

  const background = document.createElementNS(svgNamespace, "rect");
  background.setAttribute("width", "600");
  background.setAttribute("height", "600");
  background.setAttribute("fill", design.sleeveColor);
  if (finishMode !== "mask" && finishMode !== "height-mask") root.append(background);

  if (design.sleeveImage && finishMode !== "mask" && finishMode !== "height-mask") {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(Error("Could not load sleeve artwork."));
      image.src = design.sleeveImage!;
    });
    const scale =
      Math.max(600 / image.naturalWidth, 600 / image.naturalHeight) *
      design.sleeveZoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const imageNode = document.createElementNS(svgNamespace, "image");
    imageNode.setAttribute("href", design.sleeveImage);
    imageNode.setAttribute(
      "x",
      String((600 - width) / 2 + design.sleeveImageOffsetX),
    );
    imageNode.setAttribute(
      "y",
      String((600 - height) / 2 + design.sleeveImageOffsetY),
    );
    imageNode.setAttribute("width", String(width));
    imageNode.setAttribute("height", String(height));
    imageNode.setAttribute("clip-path", "url(#sleeve-texture-clip)");
    root.append(imageNode);
  }

  const sleeveLayers = document.createElementNS(svgNamespace, "g");
  sleeveLayers.setAttribute("id", "sleeve-layer-overlays");
  sleeveLayers.setAttribute("mask", "url(#sleeve-cardboard-mask)");
  // Share rendering with the canvas: tracking, line height, blur, ink bleed and 3D.
  const artwork = new DOMParser().parseFromString(
    renderToStaticMarkup(
      <LabelArtwork
        design={design}
        side={side}
        surface="sleeve"
        finishMode={finishMode}
        prefix="sleeve-export"
        fontFamily={(layer) => resolved.get(fontKey(layer))?.family ?? defaultLabelFont(layer)}
      />,
    ),
    "image/svg+xml",
  ).documentElement;
  artwork.removeAttribute("class");
  artwork.setAttribute("width", "600");
  artwork.setAttribute("height", "600");
  sleeveLayers.append(document.importNode(artwork, true));

  root.append(sleeveLayers);
  return new XMLSerializer().serializeToString(root);
}

/** One black separation, with foreground ink/images knocking out covered foil. */
export async function createFoilPlateSvg(
  design: LabelDesign, side: LabelSide, fonts: FontCatalogItem[],
  surface: LabelSurface, color: string, includeBleed: boolean, finish?: "raised-uv" | "emboss" | "deboss",
) {
  const plate = updateSurfaceLayers(design, surface, side, layers => layers.map(layer =>
    finish ? {...layer, finish: layer.finish === finish ? "silver" as const : undefined,
      ...(layer.finish ? {opacity:1,blur:0,blendMode:"normal" as const,textTexture:undefined,textEffect:undefined} : {})} :
    textFoilColor(layer) === color ? layer : {...layer, finish: undefined}));
  const source = surface === "cookie" ? await createLabelSvg(plate, side, fonts, includeBleed, "mask", false) :
    await createSleeveArtworkSvg(plate, fonts, side, "mask");
  const ns = "http://www.w3.org/2000/svg";
  const root = new DOMParser().parseFromString(source, "image/svg+xml").documentElement;
  const defs = root.querySelector("defs");
  if (!defs) throw Error("Could not prepare foil separation.");
  const mask = document.createElementNS(ns, "mask");
  mask.setAttribute("id", "foil-separation");
  mask.setAttribute("maskUnits", "userSpaceOnUse");
  mask.setAttribute("style", "mask-type:luminance");
  const [x, y, width, height] = root.getAttribute("viewBox")!.split(/\s+/).map(Number);
  for (const [key, value] of Object.entries({x, y, width, height})) mask.setAttribute(key, String(value));
  for (const child of Array.from(root.children)) if (child !== defs) mask.append(child);
  defs.append(mask);
  const ink = document.createElementNS(ns, "rect");
  for (const [key, value] of Object.entries({x, y, width, height})) ink.setAttribute(key, String(value));
  ink.setAttribute("fill", "#000000");
  ink.setAttribute("mask", "url(#foil-separation)");
  root.append(ink);
  return new XMLSerializer().serializeToString(root);
}

export async function createSleeveLabelSvg(
  labelMarkup: string,
  design: LabelDesign,
  includeBleed: boolean,
  sleeveArtworkMarkup?: string,
  side: LabelSide = "A",
) {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const sleeveSizeMm = SLEEVE_SIZE_MM;
  const labelSizeMm =
    design.diameterMm + (includeBleed ? design.bleedMm * 2 : 0);
  const labelDocument = new DOMParser().parseFromString(
    labelMarkup,
    "image/svg+xml",
  );
  if (labelDocument.querySelector("parsererror"))
    throw new Error("Could not compose the sleeve artwork.");
  const root = document.createElementNS(svgNamespace, "svg");
  root.setAttribute("xmlns", svgNamespace);
  root.setAttribute("width", `${sleeveSizeMm}mm`);
  root.setAttribute("height", `${sleeveSizeMm}mm`);
  root.setAttribute("viewBox", `0 0 ${sleeveSizeMm} ${sleeveSizeMm}`);
  if (sleeveArtworkMarkup) {
    const sleeveDocument = new DOMParser().parseFromString(
      sleeveArtworkMarkup,
      "image/svg+xml",
    );
    if (sleeveDocument.querySelector("parsererror"))
      throw new Error("Could not compose sleeve artwork.");
    const sleeveArtwork = document.importNode(
      sleeveDocument.documentElement,
      true,
    );
    sleeveArtwork.setAttribute("x", "0");
    sleeveArtwork.setAttribute("y", "0");
    sleeveArtwork.setAttribute("width", String(sleeveSizeMm));
    sleeveArtwork.setAttribute("height", String(sleeveSizeMm));
    sleeveArtwork.setAttribute("preserveAspectRatio", "xMidYMid meet");
    root.append(sleeveArtwork);
    const label = document.importNode(
      labelDocument.documentElement,
      true,
    );
    label.setAttribute("x", String((sleeveSizeMm - labelSizeMm) / 2));
    label.setAttribute("y", String((sleeveSizeMm - labelSizeMm) / 2));
    label.setAttribute("width", String(labelSizeMm));
    label.setAttribute("height", String(labelSizeMm));
    label.setAttribute("preserveAspectRatio", "xMidYMid meet");
    if (hasSleeveWindow(design, side)) root.append(label);
    return new XMLSerializer().serializeToString(root);
  }

  const defs = document.createElementNS(svgNamespace, "defs");
  const clipPath = document.createElementNS(svgNamespace, "clipPath");
  clipPath.setAttribute("id", "sleeve-art-clip");
  const clipRect = document.createElementNS(svgNamespace, "rect");
  clipRect.setAttribute("width", String(sleeveSizeMm));
  clipRect.setAttribute("height", String(sleeveSizeMm));
  clipPath.append(clipRect);
  defs.append(clipPath);
  root.append(defs);

  const background = document.createElementNS(svgNamespace, "rect");
  background.setAttribute("width", String(sleeveSizeMm));
  background.setAttribute("height", String(sleeveSizeMm));
  background.setAttribute("fill", design.sleeveColor);
  root.append(background);

  if (design.sleeveImage) {
    const sleeveImage = new Image();
    await new Promise<void>((resolve, reject) => {
      sleeveImage.onload = () => resolve();
      sleeveImage.onerror = () =>
        reject(new Error("Could not load sleeve artwork."));
      sleeveImage.src = design.sleeveImage!;
    });
    const coverScale =
      Math.max(
        sleeveSizeMm / sleeveImage.naturalWidth,
        sleeveSizeMm / sleeveImage.naturalHeight,
      ) * design.sleeveZoom;
    const imageWidth = sleeveImage.naturalWidth * coverScale;
    const imageHeight = sleeveImage.naturalHeight * coverScale;
    const image = document.createElementNS(svgNamespace, "image");
    image.setAttribute("href", design.sleeveImage);
    image.setAttribute(
      "x",
      String(
        (sleeveSizeMm - imageWidth) / 2 +
          (design.sleeveImageOffsetX * sleeveSizeMm) / 600,
      ),
    );
    image.setAttribute(
      "y",
      String(
        (sleeveSizeMm - imageHeight) / 2 +
          (design.sleeveImageOffsetY * sleeveSizeMm) / 600,
      ),
    );
    image.setAttribute("width", String(imageWidth));
    image.setAttribute("height", String(imageHeight));
    image.setAttribute("clip-path", "url(#sleeve-art-clip)");
    root.append(image);
  }

  const label = document.importNode(
    labelDocument.documentElement,
    true,
  );
  label.setAttribute("x", String((sleeveSizeMm - labelSizeMm) / 2));
  label.setAttribute("y", String((sleeveSizeMm - labelSizeMm) / 2));
  label.setAttribute("width", String(labelSizeMm));
  label.setAttribute("height", String(labelSizeMm));
  label.setAttribute("preserveAspectRatio", "xMidYMid meet");
  if (hasSleeveWindow(design, side)) root.append(label);
  return new XMLSerializer().serializeToString(root);
}

export async function captureLabelPreview(svg: string, pixels = 1024) {
  const source = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(Error("Could not capture label preview."));
      image.src = source;
    });
    const canvas = document.createElement("canvas");
    canvas.width = pixels;
    canvas.height = pixels;
    const context = canvas.getContext("2d");
    if (!context) throw Error("Could not create label preview capture.");
    context.drawImage(image, 0, 0, pixels, pixels);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(source);
  }
}

export async function exportLabelPng(
  svg: string,
  millimeters: number,
  ppi = PRINT_PPI,
) {
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
    const pixels = printPixelSize(millimeters, ppi),
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
    return new Blob(
      [setPngResolution(new Uint8Array(await png.arrayBuffer()), ppi)],
      { type: "image/png" },
    );
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
  suffix?: string,
) {
  return `${safeFilename(design.title)}-side-${side.toLowerCase()}${suffix ? `-${suffix}` : ""}.${extension}`;
}
