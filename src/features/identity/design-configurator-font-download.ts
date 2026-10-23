import { getBytes, ref } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase";
import type { FontCatalogItem } from "./font-catalog-repository";
import {
  defaultLabelFont,
  resolveLabelFont,
} from "./design-configurator-export";
import {
  safeFilename,
  type LabelDesign,
  type LabelLayer,
} from "./design-configurator-model";

type FontDownloadSource = {
  family: string;
  fileName: string;
  relativePath: string;
  extension: string;
  contentType: string;
  storagePath?: string;
  url?: string;
};

const DEFAULT_FONT_SOURCES: Record<string, FontDownloadSource> = {
  "Alte DIN Input": {
    family: "Alte DIN Input",
    fileName: "Alte DIN 1451 Mittelschrift gepraegt Regular.ttf",
    relativePath: "Alte DIN 1451 Mittelschrift gepraegt Regular.ttf",
    extension: "ttf",
    contentType: "font/ttf",
    url: "/media/fonts/Alte%20DIN%201451%20Mittelschrift%20gepraegt%20Regular.ttf",
  },
  "Berlin Type Office": {
    family: "Berlin Type Office",
    fileName: "BerlinType-Bold.otf",
    relativePath: "BerlinType-Bold.otf",
    extension: "otf",
    contentType: "font/otf",
    url: "/media/fonts/BerlinType-Bold.otf",
  },
};

function getUsedLayers(design: LabelDesign) {
  const layers = new Map<string, LabelLayer>();
  for (const layer of [...design.A, ...design.B]) {
    if (layer.kind === "image") continue;
    const key = layer.fontId
      ? `${layer.fontId}:${layer.variantId ?? "preview"}`
      : `default:${defaultLabelFont(layer)}`;
    layers.set(key, layer);
  }
  return [...layers.values()];
}

function safeZipPath(value: string, extension: string) {
  const segments = value
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..");
  const fileName = segments.pop() ?? "variant";
  const stem = safeFilename(fileName.replace(/\.[^.]+$/, ""));
  return [
    ...segments.map((segment) => safeFilename(segment)),
    `${stem || "variant"}.${extension.toLowerCase()}`,
  ].join("/");
}

async function getFontBytes(source: FontDownloadSource) {
  if (source.storagePath) {
    return getBytes(ref(firebaseStorage, source.storagePath), 64 * 1024 * 1024);
  }
  if (!source.url)
    throw new Error(`No hay archivo descargable para ${source.family}.`);
  const response = await fetch(source.url);
  if (!response.ok)
    throw new Error(`No se pudo descargar ${source.fileName}.`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function createUsedFontDownload(
  design: LabelDesign,
  fonts: FontCatalogItem[],
) {
  const usedLayers = getUsedLayers(design);
  const sources = new Map<string, FontDownloadSource>();

  for (const layer of usedLayers) {
    if (!layer.fontId) {
      const family = defaultLabelFont(layer);
      const source = DEFAULT_FONT_SOURCES[family];
      if (!source)
        throw new Error(`No se encontró el archivo local de ${family}.`);
      sources.set(source.url ?? family, source);
      continue;
    }

    const font = fonts.find((item) => item.id === layer.fontId);
    if (!font)
      throw new Error(`La fuente de «${layer.name}» no está disponible.`);
    const { variant } = await resolveLabelFont(font, layer.variantId);
    sources.set(variant.storagePath, {
      family: font.name,
      fileName: variant.fileName,
      relativePath: variant.relativePath,
      extension: variant.extension,
      contentType: variant.contentType,
      storagePath: variant.storagePath,
    });
  }

  const entries = [];
  for (const source of sources.values()) {
    entries.push({ source, bytes: await getFontBytes(source) });
  }
  if (!entries.length)
    throw new Error("El proyecto no usa ninguna fuente de texto.");

  const projectName = safeFilename(design.title);
  if (entries.length === 1) {
    const [{ source, bytes }] = entries;
    return {
      blob: new Blob([bytes], { type: source.contentType }),
      fileName: `${projectName}-${safeFilename(source.family)}.${source.extension}`,
      fontCount: 1,
    };
  }

  const { default: JSZip } = await import("jszip");
  const archive = new JSZip();
  for (const { source, bytes } of entries) {
    archive.file(
      `${safeFilename(source.family)}/${safeZipPath(source.relativePath, source.extension)}`,
      bytes,
    );
  }
  return {
    blob: await archive.generateAsync({ type: "blob" }),
    fileName: `${projectName}-fonts-in-use.zip`,
    fontCount: entries.length,
  };
}