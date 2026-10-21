export function getFontPreviewText(
  font: { name: string; previewString?: string },
  demoText = "",
) {
  if (demoText) return demoText;
  return font.previewString?.trim() ? font.previewString : font.name;
}
