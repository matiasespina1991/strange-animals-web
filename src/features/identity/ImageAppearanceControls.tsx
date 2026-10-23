import { imageRole, type LabelLayer } from "./design-configurator-model";

export function ImageAppearanceControls({ layer, onChange, onCommit }: {
  layer: LabelLayer;
  onChange: (patch: Partial<LabelLayer>, group?: string) => void;
  onCommit: () => void;
}) {
  const role = imageRole(layer);
  const color = (label: string, value: string, change: (value: string) => void) => (
    <label className="dc-image-color">
      <span>{label}</span>
      <span className="dc-image-color-value">
        <input type="color" aria-label={label} value={value} onChange={event => change(event.target.value)} onBlur={onCommit} />
        <output>{value.toUpperCase()}</output>
      </span>
    </label>
  );
  return <div className="dc-image-appearance">
    {role === "barcode" && <div className="dc-image-color-grid">
      {color("Bars & text", layer.imageBarColor ?? layer.imageBarSource?.bars ?? "#000000", imageBarColor => onChange({ imageBarColor, imageFill: undefined, imageInverted: false }, `barcode-color-${layer.id}`))}
      {color("Background", layer.imageBarBackground ?? layer.imageBarSource?.background ?? "#ffffff", imageBarBackground => onChange({ imageBarBackground, imageFill: undefined, imageInverted: false }, `barcode-background-${layer.id}`))}
    </div>}
    {role !== "brand-logo" && role !== "barcode" && layer.image?.startsWith("data:image/svg+xml") && <>
      {color("Fill color", layer.imageFill ?? "#000000", imageFill => onChange({ imageFill, imageInverted: false }, `image-fill-${layer.id}`))}
      {layer.imageFill && <button type="button" className="dc-image-reset" onClick={() => { onCommit(); onChange({ imageFill: undefined }); }}>Original colors</button>}
    </>}
    {role === "brand-logo" && <label className="dc-image-invert">
      <input type="checkbox" checked={layer.imageInverted ?? false} onChange={event => { onCommit(); onChange({ imageInverted: event.target.checked, imageFill: undefined, imageBarColor: undefined }); }} />
      <span>Invert logo colors</span>
    </label>}
    <section className="dc-image-crop" aria-label="Image crop">
      <div className="dc-image-crop-heading"><span>Crop <small>%</small></span>
        <button type="button" className="dc-image-reset" disabled={!layer.imageCrop} onClick={() => { onCommit(); onChange({ imageCrop: undefined }); }}>Reset</button>
      </div>
      <div className="dc-image-crop-grid">
        {(["top", "bottom", "left", "right"] as const).map(edge => <label key={edge}>
          <span>{edge[0].toUpperCase() + edge.slice(1)}</span>
          <input type="number" aria-label={`Crop ${edge}`} min={0} max={45} step={1} value={layer.imageCrop?.[edge] ?? 0}
            onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value)) onChange({ imageCrop: { top: 0, right: 0, bottom: 0, left: 0, ...layer.imageCrop, [edge]: Math.min(45, Math.max(0, value)) } }, `image-crop-${layer.id}`); }}
            onBlur={onCommit} onKeyUp={onCommit} />
        </label>)}
      </div>
      {role === "barcode" && <p className="dc-image-hint">Keep margins clear for reliable scanning.</p>}
    </section>
  </div>;
}
