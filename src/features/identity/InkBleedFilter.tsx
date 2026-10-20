/** Blur followed by an alpha threshold: spread ink without changing its color. */
export function InkBleedFilter({ id, amount }: { id: string; amount: number }) {
  return <filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
    <feGaussianBlur stdDeviation={amount} />
    <feComponentTransfer>
      <feFuncA type="discrete" tableValues="0 1 1 1" />
    </feComponentTransfer>
  </filter>;
}
