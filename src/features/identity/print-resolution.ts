export const PRINT_PPI = 600;

export function printPixelSize(millimeters: number): number {
  return Math.round(millimeters / 25.4 * PRINT_PPI);
}
