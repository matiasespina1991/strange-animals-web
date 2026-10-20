export type PickerFamily = { id: string; variantCount: number };

export function familyIsExpanded(font: PickerFamily, expanded: ReadonlySet<string>, seeAll: boolean) {
  return font.variantCount > 1 && (seeAll || expanded.has(font.id));
}

export function familyClickAction(font: PickerFamily, expanded: ReadonlySet<string>, seeAll: boolean) {
  return font.variantCount > 1 && !familyIsExpanded(font, expanded, seeAll) ? "expand" : "select";
}

export function toggleFamily(font: PickerFamily, expanded: ReadonlySet<string>, seeAll: boolean, visible: PickerFamily[]) {
  const next = new Set(seeAll ? visible.filter((item) => item.variantCount > 1).map((item) => item.id) : expanded);
  if (font.variantCount <= 1) return next;
  if (next.has(font.id)) next.delete(font.id); else next.add(font.id);
  return next;
}
