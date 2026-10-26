import { getSurfaceLayers, updateSurfaceLayers, type LabelDesign, type LabelSide, type LabelSurface } from "./design-configurator-model";

export function hasCustomTextColors(
  design: LabelDesign,
  side?: LabelSide,
  surface: LabelSurface = "cookie",
) {
  const layers = side
    ? getSurfaceLayers(design, surface, side)
    : [...getSurfaceLayers(design, surface, "A"), ...getSurfaceLayers(design, surface, "B")];
  return layers.some((layer) => layer.kind !== "image" && layer.customTextColor === true);
}

export function changeLayerTextColors(
  design: LabelDesign,
  side: LabelSide,
  ids: ReadonlySet<string>,
  color: string,
  surface: LabelSurface = "cookie",
): LabelDesign {
  return updateSurfaceLayers(design, surface, side, (layers) =>
    layers.map((layer) => layer.kind !== "image" && ids.has(layer.id) && layer.color.toLowerCase() !== color.toLowerCase()
      ? { ...layer, color, customTextColor: true } : layer),
  );
}

export function changeGlobalTextColor(
  design: LabelDesign,
  color: string,
  side?: LabelSide,
  surface: LabelSurface = "cookie",
): LabelDesign {
  const sides: LabelSide[] = side ? [side] : ["A", "B"];
  return sides.reduce(
    (current, currentSide) => updateSurfaceLayers(current, surface, currentSide, (layers) =>
      layers.map((layer) => layer.kind === "image" ? layer : { ...layer, color, customTextColor: false }),
    ),
    design,
  );
}

export function swapTextAndLabelColors(
  design: LabelDesign,
  side?: LabelSide,
  surface: LabelSurface = "cookie",
): LabelDesign {
  const text = (side
    ? getSurfaceLayers(design, surface, side)
    : [...getSurfaceLayers(design, surface, "A"), ...getSurfaceLayers(design, surface, "B")]
  ).filter((layer) => layer.kind !== "image");
  const color = text[0]?.color;
  if (!color || text.some((layer) => layer.color.toLowerCase() !== color.toLowerCase()) || color.toLowerCase() === design.paper.toLowerCase()) return design;
  return { ...changeGlobalTextColor(design, design.paper, side, surface), paper: color };
}
