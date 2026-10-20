import { compareFontFilterCategoryLabels, UNCATEGORIZED_LABEL } from "./font-categories";

export type FontPickerScope = "standard" | "all" | "favorites";
type Family = { id: string; name: string; parentCategory?: string | null };
const STANDARD_CATEGORIES = new Set(["Paragraph / Standard", "Condensed / Narrow"]);
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s_-]+/g, "");
export const pickerCategory = (font: Family) => font.parentCategory ?? UNCATEGORIZED_LABEL;

export function pickerCatalog<T extends Family>(fonts: T[], scope: FontPickerScope, favorites: string[], query: string) {
  const term = normalize(query), favoriteIds = new Set(favorites);
  return fonts.filter((font) => {
    if (scope === "favorites" && !favoriteIds.has(font.id)) return false;
    // Standard starts with the two working categories; search still spans the catalogue.
    if (scope === "standard" && !term && !STANDARD_CATEGORIES.has(pickerCategory(font))) return false;
    return !term || normalize(font.name).includes(term);
  }).sort((a, b) => compareFontFilterCategoryLabels(pickerCategory(a), pickerCategory(b)) ||
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

export function pickerCategories(fonts: Family[], selected: string | null) {
  const categories = new Set(fonts.map(pickerCategory));
  if (selected) categories.add(selected);
  return [...categories].sort(compareFontFilterCategoryLabels);
}
