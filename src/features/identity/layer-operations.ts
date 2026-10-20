import type { LabelDesign, LabelSide } from "./design-configurator-model";

export function removeLayers(design: LabelDesign, side: LabelSide, ids: ReadonlySet<string>): LabelDesign {
  const remaining = design[side].filter((layer) => !ids.has(layer.id));
  return remaining.length === design[side].length ? design : { ...design, [side]: remaining };
}
