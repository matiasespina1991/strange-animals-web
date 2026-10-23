import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Folder, LoaderCircle } from "lucide-react";
import {
  BRAND_ASSETS,
  loadBrandAsset,
  loadDesignConfiguratorAsset,
  type DesignConfiguratorAsset,
  type InsertableAsset,
} from "./asset-library";
import { generateBarcode } from "./barcode-generator";
import { BarcodeCreator } from "./BarcodeCreator";
import { listDesignConfiguratorAssets } from "./design-configurator-asset-repository";

export function AssetLibrary({ onInsert }: { onInsert: (asset: InsertableAsset) => void }) {
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [assetError, setAssetError] = useState("");
  const [assetLoading, setAssetLoading] = useState(true);
  const [assets, setAssets] = useState<DesignConfiguratorAsset[]>([]);
  const [assetGroup, setAssetGroup] = useState<"hvnter" | "bitmancer" | null>(null);
  const [folderPath, setFolderPath] = useState("");
  const [visibleAssetCount, setVisibleAssetCount] = useState(48);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let mounted = true;
    setAssetLoading(true);
    setAssetError("");
    listDesignConfiguratorAssets()
      .then((results) => {
        if (mounted) setAssets(results);
      })
      .catch((cause) => {
        if (mounted)
          setAssetError(cause instanceof Error ? cause.message : "Could not load the asset library.");
      })
      .finally(() => {
        if (mounted) setAssetLoading(false);
      });
    return () => { mounted = false; };
  }, [loadAttempt]);
  const barcode = useMemo(() => generateBarcode("5901234123457", "EAN13"), []);
  const groupAssets = assets.filter((asset) => asset.assetGroup === assetGroup);
  const prefix = folderPath ? `${folderPath}/` : "";
  const childFolders = [...new Set(groupAssets.flatMap((asset) => {
    if (!asset.folderPath.startsWith(prefix) || asset.folderPath === folderPath)
      return [];
    const remainder = asset.folderPath.slice(prefix.length);
    return remainder ? [remainder.split("/")[0]] : [];
  }))].sort((left, right) => left.localeCompare(right));
  const currentAssets = groupAssets
    .filter((asset) => asset.folderPath === folderPath)
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
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
  const chooseDesignAsset = async (asset: DesignConfiguratorAsset) => {
    setBusy(true);
    setError("");
    try {
      const loaded = await loadDesignConfiguratorAsset(asset);
      if (active.current) onInsert(loaded);
    } catch (cause) {
      if (active.current)
        setError(cause instanceof Error ? cause.message : "Could not load this SVG asset.");
    } finally { if (active.current) setBusy(false); }
  };
  const openGroup = (group: "hvnter" | "bitmancer") => {
    setAssetGroup(group);
    setFolderPath("");
    setVisibleAssetCount(48);
    if (group === "bitmancer") setFolderPath("");
  };
  const goBack = () => {
    setError("");
    setVisibleAssetCount(48);
    if (assetGroup === "hvnter" && folderPath.includes("/")) {
      setFolderPath(folderPath.slice(0, folderPath.lastIndexOf("/")));
    } else {
      setAssetGroup(null);
      setFolderPath("");
    }
  };
  const chooseFolder = (folder: string) => {
    setFolderPath(folderPath ? `${folderPath}/${folder}` : folder);
    setVisibleAssetCount(48);
    setError("");
  };
  const groupLabel = assetGroup === "hvnter" ? "Hvnter assets" : "Bitmancer Y2K Assets";
  if (barcodeOpen) return <BarcodeCreator onInsert={onInsert} onBack={() => setBarcodeOpen(false)} />;
  return <div className="dc-dialog-scroll">
    <p className="dc-font-explanation">Choose an asset to add to the current side.</p>
    {assetGroup ? (
      <>
        <nav className="dc-asset-breadcrumb" aria-label="Asset folders">
          <button aria-label="Back to assets" onClick={goBack}>
            <ArrowLeft size={15} />
            {groupLabel}
          </button>
          {folderPath ? <><ChevronRight size={13} /><span>{folderPath.split("/").at(-1)}</span></> : null}
        </nav>
        {assetError ? (
          <div className="dc-asset-library-error" role="alert">
            <p>{assetError}</p>
            <button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry</button>
          </div>
        ) : assetLoading ? (
          <p className="dc-font-explanation" role="status"><LoaderCircle className="dc-asset-spinner" size={16} /> Loading assets…</p>
        ) : (
          <div className="dc-assets-grid" aria-busy={busy}>
            {childFolders.map((folder) => (
              <button className="dc-asset-card" key={folder} disabled={busy} onClick={() => chooseFolder(folder)}>
                <span className="dc-asset-preview dc-asset-folder-preview"><Folder aria-hidden="true" size={28} /></span>
                <span>{folder}</span>
              </button>
            ))}
            {currentAssets.slice(0, visibleAssetCount).map((asset) => (
              <button className="dc-asset-card" key={asset.id} disabled={busy} onClick={() => void chooseDesignAsset(asset)}>
                <span className="dc-asset-preview"><img src={asset.downloadUrl} alt="" loading="lazy" /></span>
                <span>{asset.name}</span>
              </button>
            ))}
            {!childFolders.length && !currentAssets.length ? <p className="dc-font-explanation">No SVG assets in this folder.</p> : null}
            {currentAssets.length > visibleAssetCount ? (
              <button className="dc-more-fonts" onClick={() => setVisibleAssetCount((count) => count + 48)}>
                Load more assets · {currentAssets.length - visibleAssetCount} remaining
              </button>
            ) : null}
          </div>
        )}
      </>
    ) : (
      <>
        {assetError ? (
          <div className="dc-asset-library-error" role="alert">
            <p>{assetError}</p>
            <button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry</button>
          </div>
        ) : null}
        <div className="dc-assets-grid" aria-busy={busy || assetLoading}>
          {BRAND_ASSETS.map((asset) => <button className="dc-asset-card" key={asset.id} disabled={busy} onClick={() => void chooseLogo(asset)}>
            <span className="dc-asset-preview dc-asset-brand"><img src={asset.url} alt="" /></span>
            <span>{asset.name}</span>
          </button>)}
          <button className="dc-asset-card" disabled={busy} onClick={() => openGroup("hvnter")}>
            <span className="dc-asset-preview dc-asset-folder-preview"><Folder aria-hidden="true" size={28} /></span>
            <span>Hvnter assets</span>
          </button>
          <button className="dc-asset-card" disabled={busy} onClick={() => openGroup("bitmancer")}>
            <span className="dc-asset-preview dc-asset-folder-preview"><Folder aria-hidden="true" size={28} /></span>
            <span>Bitmancer Y2K Assets</span>
          </button>
          <button className="dc-asset-card" disabled={busy} onClick={() => setBarcodeOpen(true)}>
            <span className="dc-asset-preview"><img src={barcode.image} alt="" /></span>
            <span>Create barcode</span>
          </button>
        </div>
        {assetLoading ? <p className="dc-font-explanation" role="status"><LoaderCircle className="dc-asset-spinner" size={16} /> Loading SVG catalog…</p> : null}
      </>
    )}
    {busy && <p className="dc-font-explanation" role="status">Adding asset…</p>}
    {error && <p className="dc-warning" role="alert">{error}</p>}
  </div>;
}
