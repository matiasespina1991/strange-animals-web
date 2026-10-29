import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { listFontVariants, type FontCatalogItem, type FontVariant } from "./font-catalog-repository";
import { FontSpecimen } from "./FontSpecimen";

type Props = {
  font: FontCatalogItem;
  sample: string;
  selected?: string;
  busy: boolean;
  id?: string;
  preview: (font: FontCatalogItem | null, variantId?: string) => void;
  choose: (variantId: string) => void;
};

export function FontStyleTiles({ font, sample, selected, busy, preview, choose, id }: Props) {
  const [variants, setVariants] = useState<FontVariant[]>([]);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    setVariants([]);
    listFontVariants(font).then((items) => {
      if (active) {
        setVariants(items);
        if (!items.length) setError(true);
      }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [font, attempt]);
  const hover = (variant: FontVariant) => {
    preview(font, variant.id);
  };
  return <div id={id} className="dc-font-styles" aria-label={`${font.name} styles`}>
    {error ? <button onClick={() => setAttempt((value) => value + 1)}>Could not load styles. Retry</button>
      : !variants.length ? <p role="status" aria-label="Loading styles"><span className="dc-loading-circle" aria-hidden="true" /></p> : variants.map((variant) => (
        <button key={variant.id} disabled={busy} aria-pressed={selected === variant.id}
          onPointerEnter={(event) => { if (event.pointerType === "mouse") hover(variant); }}
          onPointerLeave={() => preview(null)} onFocus={() => hover(variant)} onBlur={() => preview(null)}
          onClick={() => choose(variant.id)}>
          <strong className="dc-font-title">{variant.fileName.replace(/\.(otf|ttf|woff2?)$/i, "")}{selected === variant.id && <Check size={15} aria-label="Selected style" />}</strong>
          <FontSpecimen font={font} variantId={variant.id} sample={sample} />
        </button>
      ))}
  </div>;
}
