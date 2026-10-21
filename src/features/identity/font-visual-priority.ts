/** Visible samples first, in visual reading order; then below-view prefetch. */
export function fontVisualPriority(
  bounds: { top: number; bottom: number; left: number },
  viewportHeight: number,
  viewportWidth: number,
) {
  const horizontal =
    Math.max(0, bounds.left) / Math.max(1, viewportWidth) / 1000;
  if (bounds.bottom <= 0) return 2e9 + Math.abs(bounds.bottom) + horizontal;
  if (bounds.top >= viewportHeight) return 1e9 + bounds.top + horizontal;
  return Math.max(0, bounds.top) + horizontal;
}
