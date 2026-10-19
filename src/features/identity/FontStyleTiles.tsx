import { useEffect, useState } from "react";
import { listFontVariants, type FontCatalogItem, type FontVariant } from "./font-catalog-repository";
import { resolveLabelFont } from "./design-configurator-export";

type Props = {
  font: FontCatalogItem;
  sample: string;
  selected?: string;
  busy: boolean;
  preview: (font: FontCatalogItem | null, variantId?: string) => void;
  choose: (variantId: string) => void;
};

export function FontStyleTiles({ font, sample, selected, busy, preview, choose }: Props) {
  const [variants, setVariants] = useState<FontVariant[]>([]);
  const [error, setError] = useState(false);
  const [families, setFamilies] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    listFontVariants(font).then((items) => {
      if (active) setVariants(items);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [font, attempt]);
  const hover = (variant: FontVariant) => {
    preview(font, variant.id);
    resolveLabelFont(font, variant.id).then((loaded) => {
      setFamilies((current) => ({ ...current, [variant.id]: loaded.family }));
    }).catch(() => {});
  };
  return <div className="dc-font-styles" aria-label={`${font.name} styles`}>
    {error ? <button onClick={() => setAttempt((value) => value + 1)}>Could not load styles. Retry</button>
      : !variants.length ? <p role="status">Loading styles…</p> : variants.map((variant) => (
        <button key={variant.id} disabled={busy} aria-pressed={selected === variant.id}
          onPointerEnter={(event) => { if (event.pointerType === "mouse") hover(variant); }}
          onPointerLeave={() => preview(null)} onFocus={() => hover(variant)} onBlur={() => preview(null)}
          onClick={() => choose(variant.id)}>
          <strong>{variant.fileName.replace(/\.(otf|ttf|woff2?)$/i, "")}</strong>
          <span style={{ fontFamily: families[variant.id] ?? "Alte DIN Input" }}>{sample.replace(/\n/g, " ") || font.name}</span>
        </button>
      ))}
  </div>;
}
