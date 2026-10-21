/** Spread ink with a soft alpha transition, keeping its color and solid interior. */
export function InkBleedFilter({ id, amount }: { id: string; amount: number }) {
  return <filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
    <feGaussianBlur stdDeviation={amount} />
    <feComponentTransfer>
      <feFuncA type="linear" slope={12} intercept={-2.5} />
    </feComponentTransfer>
  </filter>;
}
