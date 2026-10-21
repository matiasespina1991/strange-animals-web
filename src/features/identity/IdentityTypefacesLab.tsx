import { useDeferredValue, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, ChevronRight, Moon, Search, SlidersHorizontal, Star, Sun, X } from "lucide-react";
import { listFontCatalog, listFontVariants, loadFontVariant, type FontCatalogItem } from "./font-catalog-repository";
import "./typefaces-lab.css";

const proposals = [
  { name: "Editorial", detail: "Filtros compactos y jerarquía clara. El catálogo ocupa el centro de la experiencia.", benefit: "La evolución más cercana a la página actual." },
  { name: "Índice lateral", detail: "Las categorías viven en una columna propia. Podés cambiar de sección sin recorrer un bloque de filtros.", benefit: "Más espacio vertical para ver las fuentes." },
  { name: "Chips", detail: "Selección múltiple en una franja compacta. Los filtros activos se reconocen de un vistazo.", benefit: "Útil para combinar estilos y usos rápidamente." },
  { name: "Explorador", detail: "Un índice visual con cantidades convierte las categorías en puntos de entrada al catálogo.", benefit: "Más descubrimiento y menos listas repetidas." },
  { name: "Foco", detail: "Una categoría por vez, con un selector compacto y muestras más grandes.", benefit: "Menos ruido para evaluar el carácter de cada familia." },
];
const categoryOrder = ["Abstract", "Semi-Abstract", "Cyber", "Dotted", "LCD Display", "Goth", "Grunge", "Handwritten", "Cursive", "Outlined", "Paragraph / Standard", "Serif", "Rounded", "Squared / Tech", "Condensed / Narrow", "Title / Bold", "3D", "Pixel", "Playful", "Ornamental", "Vintage", "Wide", "Symbols & Others", "Non-Latin Script", "Uncategorized"];
const categoryLabels: Record<string, string> = { "LCD Display": "LCD/LED Display", "Non-Latin Script": "Non-Latin / 日本語" };
const categoryName = (name: string) => categoryLabels[name] ?? name;
const getCategory = (font: FontCatalogItem) => font.parentCategory ?? "Uncategorized";

function LabSpecimen({ font, text, size }: { font: FontCatalogItem; text: string; size: number }) {
  const element = useRef<HTMLElement>(null);
  const [family, setFamily] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [favorite, setFavorite] = useState(false);
  useEffect(() => {
    let active = true;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      try {
        const variants = await listFontVariants(font);
        const first = variants.find(v => v.storagePath === font.preview?.storagePath) ?? variants[0];
        if (!first) throw new Error("No preview");
        const loaded = await loadFontVariant(font, first);
        if (active) setFamily(loaded.familyName);
      } catch { if (active) setFailed(true); }
    }, { rootMargin: "160px" });
    if (element.current) observer.observe(element.current);
    return () => { active = false; observer.disconnect(); };
  }, [font]);
  return <article ref={element} className="tl-specimen">
    <div className="tl-specimen-meta"><span title={font.name}>{font.name}</span><button aria-label={`${favorite ? "Unfavorite" : "Favorite"} ${font.name}`} aria-pressed={favorite} onClick={() => setFavorite(!favorite)}><Star size={15} fill={favorite ? "currentColor" : "none"} /></button></div>
    <p className={`tl-sample ${!family ? "tl-sample-pending" : ""}`} style={{ fontFamily: family ?? "Futura, sans-serif", fontSize: size, fontWeight: 400, letterSpacing: `${font.previewLetterSpacingExtraEm ?? 0}em`, lineHeight: font.previewLineHeightExtraRem ? `calc(${size * (1.25 + (font.previewLineHeightExtra ?? 0))}px + ${font.previewLineHeightExtraRem}rem)` : 1.25 + (font.previewLineHeightExtra ?? 0) }}>{text || font.name}</p>
    <div className="tl-specimen-footer"><span>{failed ? "Preview unavailable" : !family ? "Loading preview…" : `${font.variantCount} ${font.variantCount === 1 ? "variant" : "variants"}`}</span><span>{font.formats.join(" / ").toUpperCase()}</span></div>
  </article>;
}

export function IdentityTypefacesLab() {
  const initial = Number(new URLSearchParams(window.location.search).get("v"));
  const [variant, setVariant] = useState(initial >= 1 && initial <= 5 ? initial - 1 : 0);
  const [light, setLight] = useState(true);
  const [fonts, setFonts] = useState<FontCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [text, setText] = useState("");
  const [size, setSize] = useState(48);
  const [selected, setSelected] = useState(new Set<string>());
  const [useCase, setUseCase] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [expanded, setExpanded] = useState(new Set(["Abstract", "Goth"]));
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [focus, setFocus] = useState("Goth");
  useEffect(() => {
    let active = true;
    listFontCatalog().then(data => { if (active) setFonts(data.filter(f => f.enabled)); })
      .catch(() => { if (active) setError("No se pudo cargar el catálogo. Recargá la página para reintentar."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const elements = [document.documentElement, document.body, document.getElementById("root")].filter(Boolean) as HTMLElement[];
    const previous = elements.map(el => el.style.backgroundColor);
    elements.forEach(el => { el.style.backgroundColor = light ? "#fff" : "#080808"; });
    return () => elements.forEach((el, index) => { el.style.backgroundColor = previous[index]; });
  }, [light]);
  const categories = [...new Set(fonts.map(getCategory))].sort((a, b) => {
    const i = categoryOrder.indexOf(a), j = categoryOrder.indexOf(b);
    return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || a.localeCompare(b);
  });
  const counts = new Map(categories.map(cat => [cat, fonts.filter(f => getCategory(f) === cat).length]));
  const toggle = (category: string) => {
    setCollapsed(current => { const next = new Set(current); next.delete(category); return next; });
    setSelected(current => { const next = new Set(current); next.has(category) ? next.delete(category) : next.add(category); return next; });
    setExpanded(current => new Set(current).add(category));
  };
  const chooseFocus = (category: string) => { setFocus(category); setSelected(new Set()); setExpanded(new Set([category])); };
  const visible = fonts.filter(font =>
    (!deferredSearch || font.name.toLowerCase().includes(deferredSearch.toLowerCase())) &&
    (!useCase || (useCase === "Unassigned" ? font.useCases.length === 0 : font.useCases.includes(useCase))) &&
    (selected.size === 0 || selected.has(getCategory(font))) &&
    (variant !== 4 || !!deferredSearch || getCategory(font) === focus),
  );
  const sections = categories.map(category => ({ category, fonts: visible.filter(font => getCategory(font) === category) })).filter(s => s.fonts.length);
  const selectVariant = (index: number) => {
    setVariant(index); setSelected(new Set()); setLimits({}); setCollapsed(new Set());
    const url = new URL(window.location.href); url.searchParams.set("v", String(index + 1)); window.history.replaceState(null, "", url);
  };
  const categoryControls = (style: "checks" | "list" | "chips" | "tiles") => <div className={`tl-category-options tl-options-${style}`}>
    {categories.map(category => <button key={category} aria-pressed={selected.has(category)} onClick={() => toggle(category)} className={selected.has(category) ? "is-selected" : ""}>
      {style === "checks" && <span className="tl-checkbox" aria-hidden="true">{selected.has(category) ? <Check size={12} /> : selected.size === 0 ? "−" : ""}</span>}
      <span>{categoryName(category)}</span><span className="tl-count">{counts.get(category)}</span>
      {style === "tiles" && <ArrowUpRight size={16} aria-hidden="true" />}
    </button>)}
  </div>;
  const cases = <label className="tl-use-case"><span>Use case</span><select value={useCase} onChange={e => setUseCase(e.target.value)}><option value="">All uses</option><option>CD Print</option><option>Clothing</option><option>Vinyl print</option><option>Unassigned</option></select></label>;
  return <main data-native-cursor-surface className={`identity-fonts-page typefaces-lab tl-variant-${variant + 1} ${light ? "tl-light" : "tl-dark"}`}>
    <div className="tl-shell">
      <div className="tl-lab-nav"><a href="/identity/typography/typefaces"><ArrowLeft size={14} />Catálogo actual</a><span>TYPEFACES / DESIGN LAB</span><span>01—05</span></div>
      <section className="tl-proposals" aria-label="Propuestas de diseño">
        <div className="tl-proposal-tabs" role="group" aria-label="Elegir propuesta">{proposals.map((proposal, index) => <button key={proposal.name} aria-pressed={variant === index} className={variant === index ? "is-active" : ""} onClick={() => selectVariant(index)}><span>0{index + 1}</span>{proposal.name}</button>)}</div>
        <div className="tl-proposal-description"><p>{proposals[variant].detail}</p><span>{proposals[variant].benefit}</span></div>
      </section>
      <header className="tl-brand"><a href="/identity/typography/typefaces" aria-label="Strange Animals typography"><img src="/media/images/logos/sa-logo.png" alt="Strange Animals" style={{ filter: light ? "invert(1)" : undefined }} /></a><span>identity <ChevronRight size={12} /> typography</span><button aria-label={light ? "Dark mode" : "Light mode"} onClick={() => setLight(!light)}>{light ? <Moon size={19} /> : <Sun size={19} />}</button></header>
      <div className="tl-tools"><label className="tl-demo"><span>Demo text</span><input value={text} onChange={e => setText(e.target.value)} placeholder="Escribí algo para probar…" /></label><label className="tl-search"><span>Search fonts</span><div><Search size={16} /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre de la familia" /></div></label><label className="tl-size"><span>Font size <output>{size}px</output></span><input aria-label="Font size" type="range" min={16} max={100} value={size} onChange={e => setSize(Number(e.target.value))} /></label></div>
      {error && <p role="alert" className="tl-notice">{error}</p>}
      {loading && <p role="status" className="tl-notice">Cargando catálogo…</p>}
      <div className="tl-workspace">
        {variant === 1 && <aside className="tl-sidebar"><div className="tl-filter-heading"><span>Categories</span><button onClick={() => setSelected(new Set())}>Show All</button></div>{categoryControls("list")}{cases}</aside>}
        <div className="tl-main">
          {variant === 0 && <section className="tl-filters"><div className="tl-filter-heading"><button aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={15} />Categories <ChevronDown size={13} /></button><button onClick={() => setSelected(new Set())}>Show All</button>{cases}</div>{filtersOpen && categoryControls("checks")}</section>}
          {variant === 2 && <section className="tl-filters"><div className="tl-filter-heading"><span>Browse by style</span><button onClick={() => setSelected(new Set())}>Show All</button>{cases}</div>{categoryControls("chips")}</section>}
          {variant === 3 && <section className="tl-explorer"><div className="tl-explorer-heading"><h1>Find your type.</h1><p>Elegí uno o varios estilos.<br />Dejá que las letras hablen.</p></div>{categoryControls("tiles")}<div className="tl-filter-heading"><button onClick={() => setSelected(new Set())}>Show All</button>{cases}</div></section>}
          {variant === 4 && <section className="tl-focus"><div><span>Currently exploring</span><label><span className="sr-only">Category</span><select value={focus} onChange={e => chooseFocus(e.target.value)}>{categories.map(c => <option key={c} value={c}>{categoryName(c)}</option>)}</select></label></div><p>{counts.get(focus) ?? 0} familias.<br />Un estilo por vez.</p>{cases}</section>}
          <div className="tl-results-heading"><span>{visible.length} familias{search ? ` para “${search}”` : " en el catálogo"}</span>{(selected.size > 0 || useCase || search) && <button onClick={() => { setSelected(new Set()); setUseCase(""); setSearch(""); }}>Limpiar filtros <X size={12} /></button>}</div>
          {selected.size > 0 && <div className="tl-active-filters">{[...selected].map(c => <button key={c} onClick={() => toggle(c)}>{categoryName(c)}<X size={12} /></button>)}</div>}
          {!loading && !error && sections.length === 0 && <p className="tl-notice">No hay fuentes con estos filtros. Probá otra búsqueda.</p>}
          <div className="tl-catalog">{sections.map(({ category, fonts: group }, index) => {
            const open = !collapsed.has(category) && (variant === 4 || !!search || selected.has(category) || expanded.has(category) || (variant === 1 && index === 0));
            const limit = limits[category] ?? 8;
            return <section key={category} className={`tl-category-section ${open ? "is-open" : ""}`}>
              <button className="tl-section-title" aria-expanded={open} aria-controls={`tl-section-${categoryOrder.indexOf(category)}-${category.replace(/\W/g, "")}`} onClick={() => { setCollapsed(current => { const next = new Set(current); open ? next.add(category) : next.delete(category); return next; }); setExpanded(current => new Set(current).add(category)); }}><ChevronRight size={15} className={open ? "is-rotated" : ""} /><span>{categoryName(category)}</span><span className="tl-count">{group.length} familias</span></button>
              {open && <div id={`tl-section-${categoryOrder.indexOf(category)}-${category.replace(/\W/g, "")}`}><div className="tl-specimen-grid">{group.slice(0, limit).map(font => <LabSpecimen key={font.id} font={font} text={text} size={size} />)}</div>{group.length > limit && <button className="tl-more" onClick={() => setLimits(current => ({ ...current, [category]: limit + 12 }))}>Ver más de {categoryName(category)} <span>{group.length - limit} restantes</span><ChevronDown size={14} /></button>}</div>}
            </section>;
          })}</div>
        </div>
      </div>
      <footer className="tl-footer"><span>Strange Animals / Typefaces</span><span>Propuesta 0{variant + 1} — {proposals[variant].name}</span><a href="/identity/typography/typefaces">Volver al catálogo <ArrowUpRight size={14} /></a></footer>
    </div>
  </main>;
}
