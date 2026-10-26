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
  barcodeSourceMatrix,
  circularPath,
  getSurfaceLayers,
  imageRole,
  safeFilename,
  SLEEVE_SIZE_MM,
  sleeveLabelGeometry,
  type LabelDesign,
  type LabelLayer,
  type LabelSide,
} from "./design-configurator-model";

export type ResolvedLabelFont = { family: string; variant: FontVariant };

function appendSleeveImageColorFilter(
  definitions: SVGDefsElement,
  layer: LabelLayer,
  svgNamespace: string,
) {
  const role = imageRole(layer);
  if (
    !layer.imageFill &&
    !(role === "brand-logo" && layer.imageInverted) &&
    role !== "barcode"
  )
    return undefined;

  const id = `sleeve-image-color-${layer.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const filter = document.createElementNS(svgNamespace, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("color-interpolation-filters", "sRGB");
  if (layer.imageFill) {
    const flood = document.createElementNS(svgNamespace, "feFlood");
    flood.setAttribute("flood-color", layer.imageFill);
    const composite = document.createElementNS(svgNamespace, "feComposite");
    composite.setAttribute("in2", "SourceAlpha");
    composite.setAttribute("operator", "in");
    filter.append(flood, composite);
  } else if (role === "barcode") {
    const matrix = document.createElementNS(svgNamespace, "feColorMatrix");
    matrix.setAttribute("in", "SourceGraphic");
    matrix.setAttribute("result", "barcode-source");
    matrix.setAttribute("type", "matrix");
    matrix.setAttribute("values", barcodeSourceMatrix(layer.imageBarSource));
    const transfer = document.createElementNS(
      svgNamespace,
      "feComponentTransfer",
    );
    transfer.setAttribute("in", "barcode-source");
    const bars = layer.imageBarColor ?? layer.imageBarSource?.bars ?? "#000000";
    const background =
      layer.imageBarBackground ?? layer.imageBarSource?.background ?? "#ffffff";
    const channels = [1, 3, 5];
    const functions = ["feFuncR", "feFuncG", "feFuncB"];
    for (const [index, functionName] of functions.entries()) {
      const channel = document.createElementNS(svgNamespace, functionName);
      channel.setAttribute("type", "table");
      channel.setAttribute(
        "tableValues",
        `${parseInt(bars.slice(channels[index], channels[index] + 2), 16) / 255} ${parseInt(background.slice(channels[index], channels[index] + 2), 16) / 255}`,
      );
      transfer.append(channel);
    }
    filter.append(matrix, transfer);
  } else {
    const transfer = document.createElementNS(
      svgNamespace,
      "feComponentTransfer",
    );
    for (const functionName of ["feFuncR", "feFuncG", "feFuncB"]) {
      const channel = document.createElementNS(svgNamespace, functionName);
      channel.setAttribute("type", "table");
      channel.setAttribute("tableValues", "1 0");
      transfer.append(channel);
    }
    filter.append(transfer);
  }
  definitions.append(filter);
  return id;
}

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

export async function createSleeveArtworkSvg(
  design: LabelDesign,
  fonts: FontCatalogItem[],
  side: LabelSide,
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
  cardboardMask.append(cardboardArea, cookieCutout);
  const style = document.createElementNS(svgNamespace, "style");
  style.textContent = rules.join("\n");
  defs.append(clip, cardboardMask, style);
  root.append(defs);

  const background = document.createElementNS(svgNamespace, "rect");
  background.setAttribute("width", "600");
  background.setAttribute("height", "600");
  background.setAttribute("fill", design.sleeveColor);
  root.append(background);

  if (design.sleeveImage) {
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
  for (const layer of visibleLayers) {
    if (layer.kind === "image" && layer.image) {
      const width = layer.width;
      const height = width / Math.max(layer.imageRatio ?? 1, 0.05);
      const image = document.createElementNS(svgNamespace, "image");
      image.setAttribute("href", layer.image);
      image.setAttribute("x", String(layer.x - width / 2));
      image.setAttribute("y", String(layer.y - height / 2));
      image.setAttribute("width", String(width));
      image.setAttribute("height", String(height));
      image.setAttribute("opacity", String(layer.opacity ?? 1));
      const filterId = appendSleeveImageColorFilter(defs, layer, svgNamespace);
      if (filterId) image.setAttribute("filter", `url(#${filterId})`);
      image.setAttribute(
        "transform",
        `rotate(${layer.angle} ${layer.x} ${layer.y})`,
      );
      sleeveLayers.append(image);
      continue;
    }

    const family =
      resolved.get(fontKey(layer))?.family ?? defaultLabelFont(layer);
    const textAnchor = layer.align === "middle" ? "middle" : layer.align;
    if (layer.kind === "circular") {
      const pathId = `sleeve-arc-${layer.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      const path = document.createElementNS(svgNamespace, "path");
      path.setAttribute("id", pathId);
      path.setAttribute("d", circularPath(layer));
      defs.append(path);
      const text = document.createElementNS(svgNamespace, "text");
      text.setAttribute("fill", layer.color);
      text.setAttribute("font-family", family);
      text.setAttribute("font-size", String(layer.size));
      text.setAttribute("letter-spacing", String(layer.spacing));
      text.setAttribute("text-anchor", textAnchor);
      text.setAttribute("opacity", String(layer.opacity ?? 1));
      const textPath = document.createElementNS(svgNamespace, "textPath");
      textPath.setAttribute("href", `#${pathId}`);
      textPath.setAttribute("startOffset", "50%");
      textPath.textContent = layer.text.replace(/\n/g, " ");
      text.append(textPath);
      sleeveLayers.append(text);
      continue;
    }

    const text = document.createElementNS(svgNamespace, "text");
    text.setAttribute("x", String(layer.x));
    text.setAttribute("y", String(layer.y));
    text.setAttribute("fill", layer.color);
    text.setAttribute("font-family", family);
    text.setAttribute("font-size", String(layer.size));
    text.setAttribute("letter-spacing", String(layer.spacing));
    text.setAttribute("text-anchor", textAnchor);
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("opacity", String(layer.opacity ?? 1));
    text.setAttribute(
      "transform",
      `rotate(${layer.angle} ${layer.x} ${layer.y})`,
    );
    const lines = layer.text.split("\n");
    const lineHeight = layer.size * layer.lineHeight;
    lines.forEach((line, index) => {
      const span = document.createElementNS(svgNamespace, "tspan");
      span.setAttribute("x", String(layer.x));
      span.setAttribute(
        "dy",
        String(
          index === 0 ? (-(lines.length - 1) * lineHeight) / 2 : lineHeight,
        ),
      );
      span.textContent = line;
      text.append(span);
    });
    sleeveLayers.append(text);
  }

  root.append(sleeveLayers);
  return new XMLSerializer().serializeToString(root);
}

export async function createSleeveLabelSvg(
  labelMarkup: string,
  design: LabelDesign,
  includeBleed: boolean,
  sleeveArtworkMarkup?: string,
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
    ) as SVGSVGElement;
    sleeveArtwork.setAttribute("x", "0");
    sleeveArtwork.setAttribute("y", "0");
    sleeveArtwork.setAttribute("width", String(sleeveSizeMm));
    sleeveArtwork.setAttribute("height", String(sleeveSizeMm));
    sleeveArtwork.setAttribute("preserveAspectRatio", "xMidYMid meet");
    root.append(sleeveArtwork);
    const label = document.importNode(
      labelDocument.documentElement,
      true,
    ) as SVGSVGElement;
    label.setAttribute("x", String((sleeveSizeMm - labelSizeMm) / 2));
    label.setAttribute("y", String((sleeveSizeMm - labelSizeMm) / 2));
    label.setAttribute("width", String(labelSizeMm));
    label.setAttribute("height", String(labelSizeMm));
    label.setAttribute("preserveAspectRatio", "xMidYMid meet");
    root.append(label);
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
  ) as SVGSVGElement;
  label.setAttribute("x", String((sleeveSizeMm - labelSizeMm) / 2));
  label.setAttribute("y", String((sleeveSizeMm - labelSizeMm) / 2));
  label.setAttribute("width", String(labelSizeMm));
  label.setAttribute("height", String(labelSizeMm));
  label.setAttribute("preserveAspectRatio", "xMidYMid meet");
  root.append(label);
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
