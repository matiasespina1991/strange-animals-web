import type { LabelDesign, LabelSide } from "./design-configurator-model";

export function hasCustomTextColors(design: LabelDesign, side?: LabelSide) {
  return (side ? design[side] : [...design.A, ...design.B]).some((layer) => layer.kind !== "image" && layer.customTextColor === true);
}

export function changeLayerTextColors(design: LabelDesign, side: LabelSide, ids: ReadonlySet<string>, color: string): LabelDesign {
  return {
    ...design,
    [side]: design[side].map((layer) => layer.kind !== "image" && ids.has(layer.id) && layer.color.toLowerCase() !== color.toLowerCase()
      ? { ...layer, color, customTextColor: true } : layer),
  };
}

export function changeGlobalTextColor(design: LabelDesign, color: string, side?: LabelSide): LabelDesign {
  const update = (side: LabelSide) => design[side].map((layer) => layer.kind === "image" ? layer : { ...layer, color, customTextColor: false });
  return side ? { ...design, [side]: update(side) } : { ...design, A: update("A"), B: update("B") };
}

export function swapTextAndLabelColors(design: LabelDesign, side?: LabelSide): LabelDesign {
  const text = (side ? design[side] : [...design.A, ...design.B]).filter((layer) => layer.kind !== "image");
  const color = text[0]?.color;
  if (!color || text.some((layer) => layer.color.toLowerCase() !== color.toLowerCase()) || color.toLowerCase() === design.paper.toLowerCase()) return design;
  return { ...changeGlobalTextColor(design, design.paper, side), paper: color };
}
