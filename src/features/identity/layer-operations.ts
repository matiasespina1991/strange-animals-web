import { updateSurfaceLayers, type LabelDesign, type LabelSide, type LabelSurface } from "./design-configurator-model";

export function removeLayers(
  design: LabelDesign,
  side: LabelSide,
  surface: LabelSurface,
  ids: ReadonlySet<string>,
): LabelDesign {
  return updateSurfaceLayers(design, surface, side, (layers) => {
    const remaining = layers.filter((layer) => !ids.has(layer.id));
    return remaining.length === layers.length ? layers : remaining;
  });
}
