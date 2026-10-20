import { compareFontFilterCategoryLabels, getFontCategoryDisplayName, UNCATEGORIZED_LABEL } from "./font-categories";

export type FontPickerScope = "standard" | "all" | "favorites";
type Family = { id: string; name: string; parentCategory?: string | null };
export const standardCategoriesFor = (kind: string) => kind === "circular"
  ? ["Condensed / Narrow", "Paragraph / Standard"]
  : ["Paragraph / Standard", "Title / Bold", "Condensed / Narrow"];
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s_-]+/g, "");
export const pickerCategory = (font: Family) => font.parentCategory ?? UNCATEGORIZED_LABEL;
export function pickerCategoryLabel(category: string, scope: FontPickerScope, kind: string) {
  if (scope === "standard" && category === "Paragraph / Standard") return kind === "circular" ? "Standard" : "Standard / Paragraph";
  return getFontCategoryDisplayName(category);
}

export function pickerCatalog<T extends Family>(fonts: T[], scope: FontPickerScope, favorites: string[], query: string, kind = "text") {
  const term = normalize(query), favoriteIds = new Set(favorites);
  const standard = standardCategoriesFor(kind);
  const compare = scope === "standard" && !term
    ? (a: string, b: string) => standard.indexOf(a) - standard.indexOf(b)
    : compareFontFilterCategoryLabels;
  return fonts.filter((font) => {
    if (scope === "favorites" && !favoriteIds.has(font.id)) return false;
    // Contextual defaults; search still spans the catalogue.
    if (scope === "standard" && !term && !standard.includes(pickerCategory(font))) return false;
    return !term || normalize(font.name).includes(term);
  }).sort((a, b) => compare(pickerCategory(a), pickerCategory(b)) ||
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

export function pickerCategories(fonts: Family[], selected: string | null, preferred?: string[]) {
  if (preferred) return preferred;
  const categories = new Set(fonts.map(pickerCategory));
  if (selected) categories.add(selected);
  return [...categories].sort(compareFontFilterCategoryLabels);
}
