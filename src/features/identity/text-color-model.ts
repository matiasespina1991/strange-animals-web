import type { LabelDesign, LabelSide } from "./design-configurator-model";

export function hasCustomTextColors(design: LabelDesign) {
  return [...design.A, ...design.B].some((layer) => layer.kind !== "image" && layer.customTextColor === true);
}

export function changeLayerTextColors(design: LabelDesign, side: LabelSide, ids: ReadonlySet<string>, color: string): LabelDesign {
  return {
    ...design,
    [side]: design[side].map((layer) => layer.kind !== "image" && ids.has(layer.id) && layer.color.toLowerCase() !== color.toLowerCase()
      ? { ...layer, color, customTextColor: true } : layer),
  };
}

export function changeGlobalTextColor(design: LabelDesign, color: string): LabelDesign {
  const update = (side: LabelSide) => design[side].map((layer) => layer.kind === "image" ? layer : { ...layer, color, customTextColor: false });
  return { ...design, A: update("A"), B: update("B") };
}

export function swapTextAndLabelColors(design: LabelDesign): LabelDesign {
  const text = [...design.A, ...design.B].filter((layer) => layer.kind !== "image");
  const color = text[0]?.color;
  if (!color || text.some((layer) => layer.color.toLowerCase() !== color.toLowerCase()) || color.toLowerCase() === design.paper.toLowerCase()) return design;
  return { ...changeGlobalTextColor(design, design.paper), paper: color };
}
