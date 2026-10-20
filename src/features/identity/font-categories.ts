export const FONT_PARENT_CATEGORIES = [
  "Abstract", "Semi-Abstract", "Cyber", "Dotted", "LCD Display", "Goth", "Grunge",
  "Handwritten", "Outlined", "Paragraph / Standard", "Serif", "Rounded", "Squared / Tech",
  "Condensed / Narrow", "Cursive", "Title / Bold", "3D", "Pixel", "Playful", "Ornamental",
  "Vintage", "Wide", "Symbols & Others", "Non-Latin Script",
] as const;
export const UNCATEGORIZED_LABEL = "Uncategorized";
const DISPLAY_NAMES: Record<string, string> = {
  "LCD Display": "LCD/LED Display",
  "Non-Latin Script": "Non-Latin / 日本語",
};
export const getFontCategoryDisplayName = (category: string) => DISPLAY_NAMES[category] ?? category;
const ORDER: readonly string[] = [...FONT_PARENT_CATEGORIES, UNCATEGORIZED_LABEL];
export function compareCategoryNames(left: string, right: string) {
  if (left === "3D") return right.localeCompare("Squared / Tech", undefined, { sensitivity: "base" }) <= 0 ? 1 : -1;
  if (right === "3D") return left.localeCompare("Squared / Tech", undefined, { sensitivity: "base" }) <= 0 ? -1 : 1;
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}
export function compareFontFilterCategoryLabels(left: string, right: string) {
  const l = ORDER.indexOf(left), r = ORDER.indexOf(right);
  if (l !== -1 && r !== -1) return l - r;
  if (l !== -1) return -1;
  if (r !== -1) return 1;
  return compareCategoryNames(left, right);
}
export const compareFontSectionCategoryLabels = compareFontFilterCategoryLabels;
