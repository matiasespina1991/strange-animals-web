export function fontPickerPanelLayout(height: number, fullHeight: number, expanded: boolean) {
  const keyboard = height < fullHeight * .75;
  const compact = keyboard || height < 520;
  const sheetHeight = Math.round(height * (compact ? .72 : expanded ? .7 : .56));
  return { keyboard, compact, sheetHeight, canvasHeight: height - sheetHeight };
}

export function fontPickerWidthLimits(viewportWidth: number) {
  return { min: 300, max: Math.max(300, Math.min(760, viewportWidth - 160)) };
}

export function clampFontPickerWidth(width: number, viewportWidth: number) {
  const limits = fontPickerWidthLimits(viewportWidth);
  return Math.min(limits.max, Math.max(limits.min, width));
}
