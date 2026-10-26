/** Preview-only cutout through the label and its underlying sleeve backdrop. */
export function canvasHoleMask(holeMm: number, canvasSizeMm: number): string | undefined {
  if (!Number.isFinite(holeMm) || !Number.isFinite(canvasSizeMm) || holeMm <= 0 || canvasSizeMm <= 0) return undefined;
  const radius = Math.min(300, holeMm / canvasSizeMm * 300);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><path fill="white" fill-rule="evenodd" d="M0 0H600V600H0Z M${300 - radius} 300a${radius} ${radius} 0 1 0 ${2 * radius} 0a${radius} ${radius} 0 1 0 ${-2 * radius} 0Z"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
