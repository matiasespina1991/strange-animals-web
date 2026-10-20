import { useMemo, useState } from "react";
import { BARCODE_FORMATS, generateBarcode, type BarcodeFormat } from "./barcode-generator";
import type { InsertableAsset } from "./asset-library";
import { TypographyValueControl } from "./TypographyValueControl";

export function BarcodeCreator({ onInsert, onBack }: {
  onInsert: (asset: InsertableAsset) => void;
  onBack: () => void;
}) {
  const [format, setFormat] = useState<BarcodeFormat>("EAN13");
  const [value, setValue] = useState<string>(BARCODE_FORMATS[0].example);
  const [displayValue, setDisplayValue] = useState(true);
  const [height, setHeight] = useState(160);
  const [lineColor, setLineColor] = useState("#000000");
  const [background, setBackground] = useState("#ffffff");
  const result = useMemo(() => {
    try { return { asset: generateBarcode(value, format, { displayValue, height, lineColor, background }), error: "" }; }
    catch (error) { return { asset: null, error: error instanceof Error ? error.message : "Could not generate barcode." }; }
  }, [value, format, displayValue, height, lineColor, background]);
  return <div className="dc-dialog-scroll dc-barcode-creator">
    <button className="dc-assets-back" onClick={onBack}>← Assets</button>
    <label className="dc-field"><span>Format</span>
      <select value={format} onChange={(event) => {
        const next = BARCODE_FORMATS.find((item) => item.value === event.target.value);
        if (next) { setFormat(next.value); setValue(next.example); }
      }}>{BARCODE_FORMATS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
    </label>
    <label className="dc-field"><span>Code</span>
      <input type="text" maxLength={80} value={value} aria-invalid={!!result.error} aria-describedby="barcode-hint"
        onChange={(event) => setValue(event.target.value)} />
    </label>
    <p id="barcode-hint" className="dc-font-explanation">{BARCODE_FORMATS.find((item) => item.value === format)?.hint}</p>
    <label className="dc-check"><input type="checkbox" checked={displayValue}
      onChange={(event) => setDisplayValue(event.target.checked)} />Show code below bars</label>
    <TypographyValueControl label="Bar height" unit="PX" value={height} min={40} max={400} step={1}
      onChange={setHeight} onCommit={() => {}} />
    <div className="dc-field-pair dc-barcode-colors">
      <label className="dc-field"><span>Bars & text</span>
        <input type="color" value={lineColor} onChange={(event) => setLineColor(event.target.value)} title={lineColor.toUpperCase()} />
      </label>
      <label className="dc-field"><span>Background</span>
        <input type="color" value={background} onChange={(event) => setBackground(event.target.value)} title={background.toUpperCase()} />
      </label>
    </div>
    <div className="dc-barcode-preview" aria-label="Barcode preview" aria-live="polite">
      {result.asset ? <img src={result.asset.image} alt={`Barcode ${value}`} /> : <p className="dc-warning" role="status">{result.error}</p>}
    </div>
    <p className="dc-font-explanation">Uses your code; does not register a product number. For reliable scanning, use dark bars on a light background, keep the margins and test a printed sample before production.</p>
    <button className="dc-export-confirm" disabled={!result.asset} onClick={() => { if (result.asset) onInsert(result.asset); }}>Add barcode</button>
  </div>;
}
