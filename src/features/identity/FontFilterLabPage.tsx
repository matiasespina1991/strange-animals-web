import { ArrowDown, ArrowRight, Bookmark, Check, ChevronDown, ChevronRight, Compass, Grid2X2, Layers, Library, Search, SlidersHorizontal, Sparkles, Star, Type, X } from "lucide-react";
import type { ReactNode } from "react";
import "./font-filter-lab.css";

const collections = [
  { label: "Standard", count: "48", hint: "Everyday essentials", Icon: Type },
  { label: "All fonts", count: "1,700", hint: "The complete collection", Icon: Library },
  { label: "Favorites", count: "12", hint: "Your saved families", Icon: Star },
];
const categories = ["All categories", "Abstract", "Semi-Abstract", "Cyber", "Dotted", "LCD / LED", "Goth", "Grunge", "Handwritten", "Cursive / Script", "Outlined", "Paragraph", "Serif", "Rounded", "Squared / Tech", "Condensed", "Title / Bold", "3D", "Pixel", "Playful", "Ornamental", "Vintage / Retro", "Wide", "Symbols", "Non-Latin", "Uncategorized"];

function MockButton({ children, active = false, className = "" }: { children: ReactNode; active?: boolean; className?: string }) {
  return <button type="button" aria-disabled="true" aria-pressed={active} className={className} tabIndex={-1}>{children}</button>;
}
function SearchBox() {
  return <div className="ffl-search"><Search size={18} aria-hidden="true" /><input type="search" readOnly aria-label="Search fonts — visual mockup" placeholder="Search all available fonts…" tabIndex={-1} /><span>⌘ K</span></div>;
}
function Chips({ selected = "All categories" }: { selected?: string }) {
  return <div className="ffl-chips" role="group" aria-label="Categories — two rows, visual mockup">
    {categories.map(label => <MockButton key={label} active={label === selected}>{label}</MockButton>)}
  </div>;
}
function ResultMeta({ standard = false }: { standard?: boolean }) {
  return <div className="ffl-meta"><span>{standard ? "48" : "1,700"} families</span><span><Check size={13} /> All substyles</span></div>;
}
function Results({ standard = false }: { standard?: boolean }) {
  return <div className="ffl-results" aria-label="Sample results">
    <div className="ffl-result-heading">{standard ? "Essentials" : "Abstract"}<span>Family preview</span></div>
    <div className="ffl-result"><div><b>{standard ? "Alte DIN 1451" : "3x3 dots"}</b><span>{standard ? "Regular · 1 style" : "Regular · 2 styles"}</span></div><Star size={16} /></div>
    <div className={`ffl-specimen ${standard ? "" : "ffl-specimen-strange"}`}>{standard ? "Independent sounds" : "STRANGE SOUNDS"}</div>
  </div>;
}
function Tabs({ active = "All fonts", icons = true }: { active?: string; icons?: boolean }) {
  return <div className="ffl-tabs" role="group" aria-label="Collections — visual mockup">{collections.map(({ label, count, Icon }) =>
    <MockButton key={label} active={label === active}>{icons && <Icon size={16} />}<span>{label}</span><small>{count}</small></MockButton>)}
  </div>;
}
function Segments() {
  return <div className="ffl-segments">{collections.map(({ label, Icon }) => <MockButton key={label} active={label === "All fonts"}><Icon size={17} />{label}</MockButton>)}</div>;
}
function CategoryLabel() { return <div className="ffl-section-label"><SlidersHorizontal size={14} /><span>Filter by category</span><small>Optional</small></div>; }

const concepts: { title: string; idea: string; tag: string; content: ReactNode }[] = [
  {
    title: "Tabs con jerarquía", tag: "Familiar",
    idea: "Mismo patrón, pero con línea base, iconos y cantidades. “All fonts” explica qué contiene la pestaña.",
    content: <><SearchBox /><Tabs /><p className="ffl-note"><Compass size={15} /> Explore every style, from essentials to experimental.</p><CategoryLabel /><Chips /><ResultMeta /><Results /></>,
  },
  {
    title: "Selector segmentado", tag: "Compacto",
    idea: "Una superficie compartida hace evidente que son tres opciones del mismo nivel. Las categorías quedan debajo.",
    content: <><SearchBox /><div className="ffl-section-label">Collection</div><Segments /><ResultMeta /><CategoryLabel /><Chips /><Results /></>,
  },
  {
    title: "Tres puertas de entrada", tag: "Descubrimiento",
    idea: "Cada colección es una tarjeta con descripción. El catálogo completo deja de parecer un filtro secundario.",
    content: <><SearchBox /><div className="ffl-collection-cards">{collections.map(({ label, count, hint, Icon }) => <MockButton key={label} active={label === "All fonts"}><Icon size={20} /><b>{label}</b><small>{hint}</small><strong>{count}</strong></MockButton>)}</div><CategoryLabel /><Chips /><ResultMeta /><Results /></>,
  },
  {
    title: "Navegación lateral", tag: "Dos niveles",
    idea: "Las colecciones se leen como navegación; las categorías, como refinamiento del contenido de la derecha.",
    content: <><SearchBox /><div className="ffl-sidebar-layout"><aside className="ffl-sidebar"><span>Collection</span>{collections.map(({ label, count, Icon }) => <MockButton key={label} active={label === "All fonts"}><Icon size={17} /><b>{label}</b><small>{count} families</small></MockButton>)}</aside><div className="ffl-sidebar-content"><div className="ffl-section-label">All fonts <Library size={15} /></div><p className="ffl-note">The complete collection.</p><CategoryLabel /><Chips /><ResultMeta /><Results /></div></div></>,
  },
  {
    title: "Catálogo completo primero", tag: "Sin pestaña oculta",
    idea: "Se entra al catálogo entero. Standard pasa a ser una selección opcional, no una barrera para descubrir lo experimental.",
    content: <><div className="ffl-catalog-heading"><div><small>EXPLORE THE LIBRARY</small><h3>All 1,700 families.</h3></div><Library size={30} /></div><SearchBox /><div className="ffl-shortcuts"><MockButton><Type size={16} /> Essentials only</MockButton><MockButton><Star size={16} /> My favorites <small>12</small></MockButton></div><CategoryLabel /><Chips /><ResultMeta /><Results /></>,
  },
  {
    title: "Selector con descripción", tag: "Explícito",
    idea: "Un menú de colección abierto muestra alcance y descripción de cada opción. Aquí se ve desplegado como maqueta estática.",
    content: <><SearchBox /><div className="ffl-select-label">Browse collection</div><div className="ffl-select-trigger"><Library size={18} /><b>All fonts</b><span>1,700 families</span><ChevronDown size={17} /></div><div className="ffl-select-menu">{collections.map(({ label, count, hint, Icon }) => <MockButton key={label} active={label === "All fonts"}><Icon size={18} /><span><b>{label}</b><small>{hint}</small></span><span>{count}</span>{label === "All fonts" && <Check size={16} />}</MockButton>)}</div><CategoryLabel /><Chips /><ResultMeta /></>,
  },
  {
    title: "Dos pasos visibles", tag: "Orientación",
    idea: "Separa claramente elegir la colección de filtrar sus estilos. Evita que “All” signifique dos cosas distintas.",
    content: <><SearchBox /><div className="ffl-step"><span>1</span><b>Choose your collection</b></div><Segments /><div className="ffl-step"><span>2</span><b>Narrow down the style</b><small>Optional</small></div><Chips /><ResultMeta /><Results /></>,
  },
  {
    title: "Explorador editorial", tag: "Más carácter",
    idea: "Tres bloques tipográficos con muestras distinguen esenciales, biblioteca experimental y favoritos sin depender de una línea activa.",
    content: <><SearchBox /><div className="ffl-editorial">{collections.map(({ label, count }, index) => <MockButton key={label} active={index === 1}><span className={`ffl-editorial-sample ffl-editorial-sample-${index}`}>{index === 2 ? <Bookmark size={30} /> : "Aa"}</span><b>{label}</b><small>{count} families</small>{index === 1 && <ArrowDown size={16} />}</MockButton>)}</div><CategoryLabel /><Chips /><ResultMeta /><Results /></>,
  },
  {
    title: "Colecciones desplegables", tag: "Todo a la vista",
    idea: "Las categorías viven dentro de su colección. Standard y Favorites siguen visibles como secciones hermanas.",
    content: <><SearchBox /><div className="ffl-accordion"><div className="ffl-accordion-heading"><Type size={18} /><b>Standard</b><small>48 essentials</small><ChevronRight size={17} /></div><div className="ffl-accordion-open"><div className="ffl-accordion-heading"><Library size={18} /><b>All fonts</b><small>1,700 families</small><ChevronDown size={17} /></div><p className="ffl-note">Every family, including experimental styles.</p><Chips /><Results /></div><div className="ffl-accordion-heading"><Star size={18} /><b>Favorites</b><small>12 saved</small><ChevronRight size={17} /></div></div></>,
  },
  {
    title: "Invitación a salir de Standard", tag: "Descubrimiento guiado",
    idea: "Mantiene Standard seleccionado, pero suma una entrada explícita y protagonista a las fuentes menos convencionales.",
    content: <><SearchBox /><Tabs active="Standard" icons={false} /><div className="ffl-discovery"><Sparkles size={24} /><div><b>Looking for something stranger?</b><p>Abstract, cyber, pixel and 1,700 families to explore.</p><span>Browse all fonts <ArrowRight size={16} /></span></div></div><CategoryLabel /><Chips /><ResultMeta standard /><Results standard /></>,
  },
];

export default function FontFilterLabPage() {
  return <main className="ffl-page">
    <header className="ffl-page-header"><div className="ffl-eyebrow"><span>SA / DESIGN LAB</span><span>LOCAL ONLY · UI MOCKUPS</span></div><h1>Una biblioteca.<br />Diez maneras de entrar.</h1><p>Alternativas para que Standard, All fonts y Favorites se entiendan como colecciones, y las categorías como un segundo nivel. Sin filtros funcionales, sin cambios al selector actual.</p>
      <div className="ffl-lab-details"><span><Grid2X2 size={16} /> 10 propuestas</span><span><Layers size={16} /> Chips en dos filas</span><span><SlidersHorizontal size={16} /> Datos de ejemplo</span></div>
      <nav aria-label="Ir a una propuesta">{concepts.map((concept, index) => <a key={concept.title} href={`#concept-${index + 1}`}>{String(index + 1).padStart(2, "0")}<span>{concept.title}</span></a>)}</nav>
    </header>
    <div className="ffl-concepts">{concepts.map((concept, index) => <article key={concept.title} className="ffl-concept" id={`concept-${index + 1}`}>
      <header className="ffl-concept-heading"><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{concept.title}</h2><p>{concept.idea}</p></div><small>{concept.tag}</small></header>
      <div className={`ffl-panel ffl-panel-${index + 1}`}><div className="ffl-panel-title"><div><span>TYPEFACE LIBRARY</span><b>Choose a font</b></div><X size={19} aria-hidden="true" /></div>{concept.content}</div>
    </article>)}</div>
    <footer className="ffl-footer">Solo exploración visual. Ninguna propuesta modifica el configurador ni consulta el catálogo real.</footer>
  </main>;
}
