import { useEffect, useMemo, useRef, useState } from "react";
import { BRAND_ASSETS, loadBrandAsset, type InsertableAsset } from "./asset-library";
import { generateBarcode } from "./barcode-generator";
import { BarcodeCreator } from "./BarcodeCreator";

export function AssetLibrary({ onInsert }: { onInsert: (asset: InsertableAsset) => void }) {
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const barcode = useMemo(() => generateBarcode("5901234123457", "EAN13"), []);
  const chooseLogo = async (asset: typeof BRAND_ASSETS[number]) => {
    setBusy(true);
    setError("");
    try {
      const loaded = await loadBrandAsset(asset);
      if (active.current) onInsert(loaded);
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : "Could not load asset.");
    } finally { if (active.current) setBusy(false); }
  };
  if (barcodeOpen) return <BarcodeCreator onInsert={onInsert} onBack={() => setBarcodeOpen(false)} />;
  return <div className="dc-dialog-scroll">
    <p className="dc-font-explanation">Choose an asset to add to the current side.</p>
    <div className="dc-assets-grid" aria-busy={busy}>
      {BRAND_ASSETS.map((asset) => <button className="dc-asset-card" key={asset.id} disabled={busy} onClick={() => void chooseLogo(asset)}>
        <span className="dc-asset-preview dc-asset-brand"><img src={asset.url} alt="" /></span>
        <span>{asset.name}</span>
      </button>)}
      <button className="dc-asset-card" disabled={busy} onClick={() => setBarcodeOpen(true)}>
        <span className="dc-asset-preview"><img src={barcode.image} alt="" /></span>
        <span>Create barcode</span>
      </button>
    </div>
    {busy && <p className="dc-font-explanation" role="status">Adding asset…</p>}
    {error && <p className="dc-warning" role="alert">{error}</p>}
  </div>;
}
