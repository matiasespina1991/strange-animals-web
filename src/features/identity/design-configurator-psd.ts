import { writePsd, type Layer } from "ag-psd";
import { createLabelSvg, exportLabelPng } from "./design-configurator-export";
import type { FontCatalogItem } from "./font-catalog-repository";
import type { LabelDesign, LabelSide } from "./design-configurator-model";
import { embeddedOutlineFonts, outlineText } from "./psd-text-outlines";
import { PRINT_PPI, printPixelSize } from "./print-resolution";

async function raster(
  svg: SVGSVGElement,
  pixels: number,
): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml",
    }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not render PSD layer."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = pixels;
    canvas.height = pixels;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable.");
    context.drawImage(image, 0, 0, pixels, pixels);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type PsdOptions = {
  bleed: boolean;
  onProgress?: (
    stage: string,
    details?: Record<string, string | number | boolean | undefined>,
  ) => void;
};

export async function createLabelPsd(
  design: LabelDesign,
  side: LabelSide,
  fonts: FontCatalogItem[],
  { bleed, onProgress }: PsdOptions,
): Promise<Blob> {
  onProgress?.("psd:prepare", { side, layerCount: design[side].length });
  const extra = bleed ? (design.bleedMm / design.diameterMm) * 600 : 0;
  const mm = design.diameterMm + (bleed ? design.bleedMm * 2 : 0);
  const pixels = printPixelSize(mm),
    scale = pixels / (600 + extra * 2);
  onProgress?.("psd:resolution", {
    ppi: PRINT_PPI,
    width: pixels,
    height: pixels,
  });
  if (pixels * pixels * Math.max(1, design[side].length) > 100_000_000)
    throw new Error(
      "This project exceeds the PSD memory budget. Reduce the number of layers or export SVG instead.",
    );
  const allVisible = {
    ...design,
    [side]: design[side].map((layer) => ({ ...layer, visible: true })),
  };
  onProgress?.("psd:embed-fonts");
  const markup = await createLabelSvg(allVisible, side, fonts, bleed);
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none";
  host.innerHTML = markup; // Serialized by our SVG renderer; never raw user markup.
  const svg = host.querySelector("svg")!;
  svg.setAttribute("width", String(pixels));
  svg.setAttribute("height", String(pixels));
  document.body.append(host);
  try {
    onProgress?.("psd:decode-fonts");
    const outlineFonts = embeddedOutlineFonts(svg);
    const fallbacks = ["Alte DIN Input", "Berlin Type Office"].flatMap(
      (family) => {
        const font = outlineFonts.get(family);
        return font ? [{ family, font }] : [];
      },
    );
    const vectorPaths = new Map<string, ReturnType<typeof outlineText>>();
    for (const text of Array.from(svg.querySelectorAll("text"))) {
      const layerId = text
        .closest("[data-layer-id]")
        ?.getAttribute("data-layer-id");
      const layer = design[side].find((layer) => layer.id === layerId);
      if (layer?.textEffect || layer?.blur || layer?.textTexture) continue;
      onProgress?.("psd:outline-text", {
        layerId: layerId ?? undefined,
        fontFamily: text.getAttribute("font-family") ?? undefined,
      });
      const font = outlineFonts.get(text.getAttribute("font-family") ?? "");
      if (!font)
        throw new Error(
          "PSD outlines require an OTF, TTF or WOFF source. This font could not be decoded; no raster substitute was exported.",
        );
      // No per-character outlines for contextual shaping: never silently export broken glyphs.
      if (
        /[\u0300-\u036f\u0590-\u08ff\u0900-\u0dff]/.test(text.textContent ?? "")
      )
        throw new Error(
          "PSD outlining of contextual scripts is not supported yet. Use SVG for this text.",
        );
      text.style.fontVariantLigatures = "none";
      const primaryFamily = text.getAttribute("font-family")!;
      text.setAttribute(
        "font-family",
        [primaryFamily, ...fallbacks.map((item) => item.family)]
          .map((family) => JSON.stringify(family))
          .join(","),
      );
      vectorPaths.set(
        layerId!,
        outlineText(text, font, scale, { extra, fallbacks }),
      );
    }
    const nodes = Array.from(
      svg.querySelectorAll<SVGGElement>("[data-layer-id]"),
    );
    const content = svg.querySelector<SVGGElement>("svg > g")!;
    const paperNodes = Array.from(content.children).filter(
      (node) => !node.hasAttribute("data-layer-id"),
    );
    const children: Layer[] = [];
    for (const node of nodes) node.style.display = "none";
    onProgress?.("psd:render-label", { pixels });
    children.push({ name: "Label", canvas: await raster(svg, pixels) });
    for (const node of paperNodes) node.setAttribute("display", "none");
    for (const layer of design[side]) {
      onProgress?.("psd:render-layer", {
        layerId: layer.id,
        kind: layer.kind,
        hidden: !layer.visible,
      });
      const node = nodes.find(
        (item) => item.getAttribute("data-layer-id") === layer.id,
      );
      if (!node) continue;
      node.style.display = "";
      // Export opacity as an editable layer setting, without baking it twice.
      const appearance = node.querySelector<SVGGElement>(
        "[data-layer-appearance]",
      );
      const savedOpacity = appearance?.getAttribute("opacity");
      appearance?.setAttribute("opacity", "1");
      let canvas: HTMLCanvasElement;
      try {
        canvas = await raster(svg, pixels);
      } finally {
        if (savedOpacity != null)
          appearance?.setAttribute("opacity", savedOpacity);
        else appearance?.removeAttribute("opacity");
      }
      node.style.display = "none";
      const paths = vectorPaths.get(layer.id);
      const output: Layer = {
        name: layer.name,
        hidden: !layer.visible,
        opacity: layer.opacity ?? 1,
        canvas,
        ...(layer.blendMode === "difference"
          ? { blendMode: "difference" }
          : {}),
      };
      if (paths?.length) {
        const fillColor =
          layer.blendMode === "difference" ? "#ffffff" : layer.color;
        const rgb = {
          r: parseInt(fillColor.slice(1, 3), 16),
          g: parseInt(fillColor.slice(3, 5), 16),
          b: parseInt(fillColor.slice(5, 7), 16),
        };
        const shape: Layer = {
          name: `${layer.name} · outlines`,
          canvas,
          vectorFill: { type: "color", color: rgb },
          vectorMask: { paths },
        };
        if (layer.inkBleed)
          output.children = [
            { ...shape, hidden: true },
            { name: "Ink bleed appearance", canvas },
          ];
        else
          Object.assign(output, {
            vectorFill: shape.vectorFill,
            vectorMask: shape.vectorMask,
          });
        if (output.children) delete output.canvas;
      }
      children.push(output);
    }
    // All editable layers share the physical trim/hole mask, including vector shapes.
    const mask = document.createElement("canvas");
    mask.width = pixels;
    mask.height = pixels;
    const context = mask.getContext("2d")!;
    context.fillStyle = "#000";
    context.fillRect(0, 0, pixels, pixels);
    context.fillStyle = "#fff";
    context.beginPath();
    context.arc(pixels / 2, pixels / 2, (300 + extra) * scale, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#000";
    context.beginPath();
    context.arc(
      pixels / 2,
      pixels / 2,
      (design.holeMm / design.diameterMm) * 300 * scale,
      0,
      Math.PI * 2,
    );
    context.fill();
    for (const node of paperNodes) node.removeAttribute("display");
    for (const layer of design[side]) {
      const node = nodes.find(
        (item) => item.getAttribute("data-layer-id") === layer.id,
      );
      if (node) node.style.display = layer.visible ? "" : "none";
    }
    onProgress?.("psd:render-composite");
    const canvas = await raster(svg, pixels);
    onProgress?.("psd:write-file", { layerCount: children.length });
    return new Blob(
      [
        writePsd({
          width: pixels,
          height: pixels,
          canvas,
          children: [
            {
              name: `Side ${side}`,
              children,
              mask: { canvas: mask, defaultColor: 0 },
            },
          ],
          imageResources: {
            resolutionInfo: {
              horizontalResolution: PRINT_PPI,
              verticalResolution: PRINT_PPI,
              horizontalResolutionUnit: "PPI",
              verticalResolutionUnit: "PPI",
              widthUnit: "Centimeters",
              heightUnit: "Centimeters",
            },
          },
        }),
      ],
      { type: "image/vnd.adobe.photoshop" },
    );
  } finally {
    host.remove();
  }
}

export async function createSleeveLabelPsd(
  design: LabelDesign,
  side: LabelSide,
  fonts: FontCatalogItem[],
  { bleed, onProgress }: PsdOptions,
): Promise<Blob> {
  const ppi = 300;
  const sleeveSizeMm = 315;
  const labelSizeMm = design.diameterMm + (bleed ? design.bleedMm * 2 : 0);
  const pixels = printPixelSize(sleeveSizeMm, ppi);
  const labelPixels = printPixelSize(labelSizeMm, ppi);
  onProgress?.("psd:sleeve-composite", { side, ppi, width: pixels });

  const labelSvg = await createLabelSvg(design, side, fonts, bleed);
  const labelPng = await exportLabelPng(labelSvg, labelSizeMm, ppi);
  const labelUrl = URL.createObjectURL(labelPng);
  const labelImage = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      labelImage.onload = () => resolve();
      labelImage.onerror = () =>
        reject(new Error("Could not render label layer."));
      labelImage.src = labelUrl;
    });

    const sleeveCanvas = document.createElement("canvas");
    sleeveCanvas.width = pixels;
    sleeveCanvas.height = pixels;
    const sleeveContext = sleeveCanvas.getContext("2d");
    if (!sleeveContext) throw new Error("Canvas unavailable.");
    sleeveContext.fillStyle = design.sleeveColor;
    sleeveContext.fillRect(0, 0, pixels, pixels);
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
          pixels / sleeveImage.naturalWidth,
          pixels / sleeveImage.naturalHeight,
        ) * design.sleeveZoom;
      const imageWidth = sleeveImage.naturalWidth * coverScale;
      const imageHeight = sleeveImage.naturalHeight * coverScale;
      sleeveContext.save();
      sleeveContext.beginPath();
      sleeveContext.rect(0, 0, pixels, pixels);
      sleeveContext.clip();
      sleeveContext.drawImage(
        sleeveImage,
        (pixels - imageWidth) / 2,
        (pixels - imageHeight) / 2,
        imageWidth,
        imageHeight,
      );
      sleeveContext.restore();
    }

    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = pixels;
    labelCanvas.height = pixels;
    const labelContext = labelCanvas.getContext("2d");
    if (!labelContext) throw new Error("Canvas unavailable.");
    const labelOffset = (pixels - labelPixels) / 2;
    labelContext.drawImage(
      labelImage,
      labelOffset,
      labelOffset,
      labelPixels,
      labelPixels,
    );

    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = pixels;
    compositeCanvas.height = pixels;
    const compositeContext = compositeCanvas.getContext("2d");
    if (!compositeContext) throw new Error("Canvas unavailable.");
    compositeContext.drawImage(sleeveCanvas, 0, 0);
    compositeContext.drawImage(labelCanvas, 0, 0);
    return new Blob(
      [
        writePsd({
          width: pixels,
          height: pixels,
          canvas: compositeCanvas,
          children: [
            { name: "Sleeve", canvas: sleeveCanvas },
            { name: `Record label · ${side}`, canvas: labelCanvas },
          ],
          imageResources: {
            resolutionInfo: {
              horizontalResolution: ppi,
              verticalResolution: ppi,
              horizontalResolutionUnit: "PPI",
              verticalResolutionUnit: "PPI",
              widthUnit: "Centimeters",
              heightUnit: "Centimeters",
            },
          },
        }),
      ],
      { type: "image/vnd.adobe.photoshop" },
    );
  } finally {
    URL.revokeObjectURL(labelUrl);
  }
}
