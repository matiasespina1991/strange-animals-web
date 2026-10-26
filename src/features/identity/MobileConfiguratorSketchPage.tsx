import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Disc3,
  Download,
  Eye,
  FileText,
  Grid2X2,
  Layers3,
  Maximize,
  Minus,
  MoreHorizontal,
  Plus,
  Redo2,
  Save,
  SlidersHorizontal,
  Type,
  Undo2,
} from "lucide-react";
import { VINYL_DESIGNER_WIZARD_PRO_PATH } from "./identity-routes";
import "./mobile-configurator-sketch.css";

type Concept = "dock" | "sheet";
type Panel = "Elements" | "Properties" | "Fonts";

const concepts: {
  id: Concept;
  number: string;
  title: string;
  detail: string;
}[] = [
  {
    id: "dock",
    number: "01",
    title: "Canvas fijo + panel",
    detail:
      "El lienzo mantiene su altura; el inspector tiene su propio scroll debajo.",
  },
  {
    id: "sheet",
    number: "02",
    title: "Lienzo + bandeja",
    detail:
      "El lienzo queda anclado y las herramientas aparecen en una bandeja deslizable.",
  },
];

const colorOptions = ["#f9f9f4", "#171916", "#777a75", "#30332f"];
const vinylPreview =
  "/media/images/releases/sajs001/photos/Strange%20Animals%20VA%20Odyssey%20vol%20I%20Vinyl-preview.jpg";

function GlobalSettings({
  compact = false,
  sleeveColor,
  onSleeveColorChange,
}: {
  compact?: boolean;
  sleeveColor: string;
  onSleeveColorChange: (color: string) => void;
}) {
  const [expanded, setExpanded] = useState(!compact);
  const [activeColors, setActiveColors] = useState([1, 0, 1]);
  const groups = ["Text color", "Label", "Sleeve"];

  return (
    <section className={`mcs-global${expanded ? " is-expanded" : ""}`}>
      <button
        type="button"
        className="mcs-global-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <span>Global settings</span>
        <span className="mcs-global-summary">
          {expanded ? "3 color groups" : "3 groups"}
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {expanded && (
        <div className="mcs-global-list">
          {groups.map((group, groupIndex) => (
            <div className="mcs-global-row" key={group}>
              <span>{group}</span>
              <div
                className="mcs-swatches"
                role="group"
                aria-label={`${group} swatches`}
              >
                {colorOptions.map((color, colorIndex) => (
                  <button
                    type="button"
                    key={color}
                    className={
                      activeColors[groupIndex] === colorIndex
                        ? "is-selected"
                        : ""
                    }
                    style={{ "--mcs-swatch": color } as React.CSSProperties}
                    aria-label={`${group} ${color}`}
                    aria-pressed={activeColors[groupIndex] === colorIndex}
                    onClick={() => {
                      setActiveColors((current) =>
                        current.map((value, index) =>
                          index === groupIndex ? colorIndex : value,
                        ),
                      );
                      if (groupIndex === 2) onSleeveColorChange(color);
                    }}
                  >
                    {activeColors[groupIndex] === colorIndex && (
                      <Check size={13} aria-hidden="true" />
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  className="mcs-add-color"
                  aria-label={`Add ${group} color`}
                >
                  <Plus size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectBar({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`mcs-project${compact ? " is-compact" : ""}`}>
      <div className="mcs-project-title">
        <div>
          <span className="mcs-project-kicker">
            VINYL LABEL / LOCAL AUTOSAVE
          </span>
          <strong>Untitled project</strong>
        </div>
        <button type="button" aria-label="Project options">
          <MoreHorizontal size={19} />
        </button>
      </div>
      <div className="mcs-project-actions">
        <button type="button" aria-label="Undo">
          <Undo2 size={17} />
        </button>
        <button type="button" aria-label="Redo">
          <Redo2 size={17} />
        </button>
        {!compact && (
          <button type="button" className="mcs-action-labeled">
            <FileText size={16} />
            <span>File</span>
          </button>
        )}
        <button type="button" className="mcs-action-labeled mcs-save">
          <Save size={16} />
          <span>Save</span>
        </button>
        <button type="button" className="mcs-action-labeled mcs-export">
          <Download size={16} />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
}

function CanvasStage({
  sheet = false,
  surface,
  side,
  sleeveColor,
  onSurfaceChange,
  onSideChange,
}: {
  sheet?: boolean;
  surface: "Cookie" | "Sleeve";
  side: "A" | "B";
  sleeveColor: string;
  onSurfaceChange: (surface: "Cookie" | "Sleeve") => void;
  onSideChange: (side: "A" | "B") => void;
}) {
  return (
    <section
      className={`mcs-stage${sheet ? " mcs-stage-sheet" : ""}`}
      aria-label="Design workspace"
    >
      <div className="mcs-stage-heading">
        <div className="mcs-stage-context">
          <div className="mcs-surface-switch" role="group" aria-label="Surface">
            {(["Cookie", "Sleeve"] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={surface === value}
                onClick={() => onSurfaceChange(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="mcs-side-switch" role="group" aria-label="Side">
            {(["A", "B"] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={side === value}
                onClick={() => onSideChange(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <span className="mcs-preview-label">
            <i /> PREVIEW
          </span>
        </div>
        <button type="button" aria-label="Toggle guides">
          <Grid2X2 size={15} />
          <span>Guides</span>
        </button>
      </div>
      <div className="mcs-canvas">
        <div
          className={`mcs-artboard${surface === "Sleeve" ? " is-sleeve" : ""}`}
          style={{
            backgroundColor: surface === "Sleeve" ? sleeveColor : "#171916",
          }}
        >
          <img
            src={
              surface === "Sleeve"
                ? "/media/images/releases/sajs001/cover.png"
                : vinylPreview
            }
            alt={
              surface === "Sleeve"
                ? "Sleeve cover artwork"
                : "Clear vinyl with the Strange Animals Odyssey label"
            }
          />
        </div>
      </div>
      <div className="mcs-canvas-tools">
        <span>
          {surface.toUpperCase()} <b>·</b> SIDE {side}
        </span>
        <div>
          <button type="button" aria-label="Zoom out">
            <Minus size={14} />
          </button>
          <strong>100%</strong>
          <button type="button" aria-label="Zoom in">
            <Plus size={14} />
          </button>
        </div>
        <button type="button" aria-label="Fit canvas">
          <Maximize size={15} />
        </button>
      </div>
    </section>
  );
}

function PanelTabs({
  active,
  onChange,
}: {
  active: Panel;
  onChange: (panel: Panel) => void;
}) {
  const tabs: { name: Panel; icon: typeof Layers3 }[] = [
    { name: "Elements", icon: Layers3 },
    { name: "Properties", icon: SlidersHorizontal },
    { name: "Fonts", icon: Type },
  ];
  return (
    <nav className="mcs-panel-tabs" aria-label="Editor panels">
      {tabs.map(({ name, icon: Icon }) => (
        <button
          type="button"
          key={name}
          aria-pressed={active === name}
          onClick={() => onChange(name)}
        >
          <Icon size={16} />
          <span>{name}</span>
        </button>
      ))}
    </nav>
  );
}

function PanelContent({ active, side }: { active: Panel; side: "A" | "B" }) {
  if (active === "Elements") {
    const layers =
      side === "A"
        ? [
            { name: "Arc text", kind: "Text arc" },
            { name: "Tracklist", kind: "Text layer" },
            { name: "Artist", kind: "Text layer" },
          ]
        : [
            { name: "Arc text", kind: "Text arc" },
            { name: "Release info", kind: "Text layer" },
            { name: "Barcode", kind: "Image / logo" },
          ];
    return (
      <div className="mcs-element-list">
        <small className="mcs-side-caption">
          SIDE {side} LAYERS · SHARED BETWEEN SURFACES
        </small>
        {layers.map((layer, index) => (
          <button
            type="button"
            className={index === 0 ? "is-current" : ""}
            key={layer.name}
          >
            <Type size={15} />
            <span>
              <b>{layer.name}</b>
              <small>{layer.kind}</small>
            </span>
            <Eye size={15} />
          </button>
        ))}
        <button type="button" className="mcs-add-layer">
          <Plus size={15} /> Add element
        </button>
      </div>
    );
  }
  if (active === "Fonts") {
    return (
      <div className="mcs-font-content">
        <label>
          Font family
          <input value="Alte DIN 1451" readOnly />
        </label>
        <div>
          <button type="button" aria-pressed="true">
            Regular
          </button>
          <button type="button">Medium</button>
          <button type="button">Bold</button>
        </div>
      </div>
    );
  }
  return (
    <div className="mcs-property-content">
      <label>
        Content
        <textarea
          readOnly
          value="℗ & © 2026 STRANGE ANIMALS. ALL RIGHTS RESERVED."
        />
      </label>
      <div className="mcs-property-grid">
        <label>
          Size
          <input value="11" readOnly />
        </label>
        <label>
          Tracking
          <input value="0.7" readOnly />
        </label>
      </div>
      <div className="mcs-property-foot">
        <span>Typography</span>
        <ChevronRight size={15} />
      </div>
    </div>
  );
}

function MobileConcept({ concept }: { concept: Concept }) {
  const [activePanel, setActivePanel] = useState<Panel>("Properties");
  const [sheetOpen, setSheetOpen] = useState(true);
  const [surface, setSurface] = useState<"Cookie" | "Sleeve">("Cookie");
  const [side, setSide] = useState<"A" | "B">("A");
  const [sleeveColor, setSleeveColor] = useState("#171916");
  const sheetConcept = concept === "sheet";

  return (
    <article className={`mcs-concept mcs-concept-${concept}`}>
      <header className="mcs-concept-heading">
        <div>
          <span>{concepts.find((item) => item.id === concept)?.number}</span>
          <h2>{concepts.find((item) => item.id === concept)?.title}</h2>
        </div>
        <p>{concepts.find((item) => item.id === concept)?.detail}</p>
      </header>
      <div className={`mcs-device${sheetConcept ? " mcs-device-sheet" : ""}`}>
        <div className={`mcs-screen${sheetConcept ? " mcs-screen-sheet" : ""}`}>
          <ProjectBar compact={sheetConcept} />
          <GlobalSettings
            compact={sheetConcept}
            sleeveColor={sleeveColor}
            onSleeveColorChange={setSleeveColor}
          />
          <CanvasStage
            sheet={sheetConcept}
            surface={surface}
            side={side}
            sleeveColor={sleeveColor}
            onSurfaceChange={setSurface}
            onSideChange={setSide}
          />
          {sheetConcept ? (
            <section
              className={`mcs-inspector-sheet${sheetOpen ? " is-open" : " is-collapsed"}`}
            >
              <button
                type="button"
                className="mcs-sheet-handle"
                aria-label={
                  sheetOpen ? "Collapse inspector" : "Expand inspector"
                }
                onClick={() => setSheetOpen((open) => !open)}
              >
                <span />
              </button>
              <div className="mcs-sheet-heading">
                <strong>{activePanel}</strong>
                <button
                  type="button"
                  aria-label="Collapse inspector"
                  onClick={() => setSheetOpen(false)}
                >
                  <ChevronDown size={17} />
                </button>
              </div>
              {sheetOpen && (
                <>
                  <PanelTabs active={activePanel} onChange={setActivePanel} />
                  <div className="mcs-panel-scroll">
                    <PanelContent active={activePanel} side={side} />
                  </div>
                </>
              )}
            </section>
          ) : (
            <section className="mcs-inspector-dock">
              <PanelTabs active={activePanel} onChange={setActivePanel} />
              <div className="mcs-panel-scroll">
                <PanelContent active={activePanel} side={side} />
              </div>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}

export default function MobileConfiguratorSketchPage() {
  const [activeConcept, setActiveConcept] = useState<Concept>("dock");

  return (
    <main className="mcs-page">
      <header className="mcs-header">
        <a href="/dev/configurator-controls">
          <ArrowLeft size={15} /> Controls
        </a>
        <span>DEVELOPMENT / IDENTITY</span>
      </header>
      <div className="mcs-main">
        <nav className="mcs-dev-tabs" aria-label="Development studies">
          <a href="/dev/configurator-controls">Controls</a>
          <a href="/dev/configurator-mobile-sketch" aria-current="page">
            Mobile layout
          </a>
        </nav>
        <section className="mcs-intro">
          <div>
            <p className="mcs-kicker">
              VINYL DESIGNER WIZARD PRO · MOBILE STUDY
            </p>
            <h1>Mobile workspace</h1>
          </div>
          <a href={VINYL_DESIGNER_WIZARD_PRO_PATH}>
            Open Vinyl Designer Wizard Pro <ArrowRight size={15} />
          </a>
        </section>
        <div
          className="mcs-concept-switch"
          role="group"
          aria-label="Choose mobile layout"
        >
          {concepts.map((concept) => (
            <button
              type="button"
              key={concept.id}
              aria-pressed={activeConcept === concept.id}
              onClick={() => setActiveConcept(concept.id)}
            >
              <span>{concept.number}</span>
              {concept.title}
            </button>
          ))}
        </div>
        <section className="mcs-comparison" aria-label="Mobile layout options">
          {concepts.map((concept) => (
            <div
              className="mcs-concept-slot"
              data-active={activeConcept === concept.id}
              key={concept.id}
            >
              <MobileConcept concept={concept.id} />
            </div>
          ))}
        </section>
        <footer className="mcs-page-footer">
          <span>STRANGE ANIMALS / DESIGN TOOLS</span>
          <a href="/dev/configurator-controls">
            Back to control study <ArrowRight size={13} />
          </a>
        </footer>
      </div>
    </main>
  );
}
