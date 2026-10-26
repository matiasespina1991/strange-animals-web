/** Leave one swatch diameter clear beside the custom color and reserve the + button. */
export function colorSwatchCapacity(width: number, size: number, gap: number, moreWidth: number, outerGap: number, total: number) {
  if (!Number.isFinite(width) || width <= 0 || size <= 0 || total <= 0) return 0;
  width = Math.max(0, width - size);
  if (total * size + Math.max(0, total - 1) * gap <= width) return total;
  return Math.max(1, Math.min(total, 14, Math.floor((width - moreWidth - outerGap + gap) / (size + gap))));
}
