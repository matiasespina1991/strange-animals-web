export function fontPickerPanelLayout(height: number, fullHeight: number, expanded: boolean) {
  const keyboard = height < fullHeight * .75;
  const compact = keyboard || height < 520;
  const sheetHeight = Math.round(height * (compact ? .72 : expanded ? .7 : .56));
  return { keyboard, compact, sheetHeight, canvasHeight: height - sheetHeight };
}
