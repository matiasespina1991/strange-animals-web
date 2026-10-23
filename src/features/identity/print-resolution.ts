export const PRINT_PPI = 600;

export function printPixelSize(millimeters: number, ppi = PRINT_PPI): number {
  return Math.round((millimeters / 25.4) * ppi);
}
