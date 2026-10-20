import { useEffect, useRef, useState } from "react";
import { resolveLabelFont } from "./design-configurator-export";
import type { FontCatalogItem } from "./font-catalog-repository";

/** Loads near the scroll viewport, independently of hover, without fallback glyphs. */
export function FontSpecimen({ font, variantId, sample }: {
  font: FontCatalogItem; variantId?: string; sample: string;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const [family, setFamily] = useState<string>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFamily(undefined);
    setError(false);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      resolveLabelFont(font, variantId).then((loaded) => {
        if (active) setFamily(loaded.family);
      }).catch(() => { if (active) setError(true); });
    }, { root: root.current?.closest(".dc-font-results") ?? null, rootMargin: "120px" });
    if (root.current) observer.observe(root.current);
    return () => { active = false; observer.disconnect(); };
  }, [font, variantId, attempt]);
  return <span ref={root} className="dc-font-specimen" aria-busy={!family && !error}>
    {family ? <span style={{ fontFamily: family }}>{sample.replace(/\n/g, " ").slice(0, 100) || font.name}</span>
      : error ? <span className="dc-font-load-error" role="status"
        onClick={(event) => { event.stopPropagation(); setAttempt((value) => value + 1); }}>Preview unavailable · retry</span>
        : <span role="status" aria-label={`Loading ${font.name}`} className="dc-font-loading"><span className="dc-loading-circle" aria-hidden="true" /></span>}
  </span>;
}
