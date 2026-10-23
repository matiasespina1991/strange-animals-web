import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  GripVertical,
  Layers3,
  PanelLeftClose,
  PanelLeftOpen,
  Rows3,
  Trash2,
  Type,
} from "lucide-react";
import "./layer-panel-layouts-lab.css";

const layoutOptions = [
  {
    id: "resize",
    number: "01",
    title: "Tirador lateral",
    description: "Arrastrar el borde o ajustar con un slider. Ancho preciso.",
  },
  {
    id: "rail",
    number: "02",
    title: "Rail plegable",
    description: "Chevron para contraer a iconos y recuperar el lienzo.",
  },
  {
    id: "density",
    number: "03",
    title: "Densidad ajustable",
    description: "Filas compactas o cómodas sin ocultar nombres ni estado.",
  },
  {
    id: "actions",
    number: "04",
    title: "Acciones arriba",
    description: "Reordenar herramientas y liberar espacio para las capas.",
  },
  {
    id: "groups",
    number: "05",
    title: "Grupos plegables",
    description: "Dejar visibles los layers y esconder controles secundarios.",
  },
] as const;

type LayoutId = (typeof layoutOptions)[number]["id"];

const layerNames = ["Artist", "Release title", "Tracklist", "Arc text"];

function MiniPanel({ layout }: { layout: LayoutId }) {
  return (
    <div className={`lpl-mini lpl-mini--${layout}`} aria-hidden="true">
      <div className="lpl-mini-heading">
        {layout === "rail" ? <Layers3 size={13} /> : <span>Elements</span>}
        {layout === "rail" ? null : <ChevronLeft size={12} />}
      </div>
      {layout === "rail" ? (
        <div className="lpl-mini-rail-icons">
          <Layers3 size={13} />
          <Type size={13} />
          <Eye size={13} />
          <Rows3 size={13} />
        </div>
      ) : (
        <>
          {layout === "actions" ? (
            <div className="lpl-mini-actions lpl-mini-actions--top">
              <ArrowUp size={11} />
              <ArrowDown size={11} />
              <Copy size={11} />
              <Trash2 size={11} />
            </div>
          ) : null}
          {layout === "groups" ? (
            <div className="lpl-mini-group">
              SIDE A <ChevronDown size={10} />
            </div>
          ) : (
            <div className="lpl-mini-sides">
              <span>Side A</span>
              <span>Side B</span>
            </div>
          )}
          {layout !== "actions" ? (
            <div className="lpl-mini-actions">
              <ArrowUp size={11} />
              <ArrowDown size={11} />
              <Copy size={11} />
              <Trash2 size={11} />
            </div>
          ) : null}
          {layout === "groups" ? (
            <div className="lpl-mini-group">
              LAYERS <ChevronDown size={10} />
            </div>
          ) : null}
          <div className="lpl-mini-list">
            {layerNames.slice(0, 3).map((name, index) => (
              <div className="lpl-mini-row" key={name}>
                <Type size={11} />
                <span>{name}</span>
                {index === 0 ? <Eye size={10} /> : null}
              </div>
            ))}
          </div>
          {layout === "resize" ? (
            <div className="lpl-mini-grip">
              <GripVertical size={13} />
            </div>
          ) : null}
          {layout === "density" ? (
            <div className="lpl-mini-density">COMPACT / COMFORTABLE</div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function LayerPanelLayoutsLabPage() {
  const [selectedLayout, setSelectedLayout] = useState<LayoutId>("resize");
  const [panelWidth, setPanelWidth] = useState(264);
  const [compact, setCompact] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [layersOpen, setLayersOpen] = useState(true);
  const dragStart = useRef<{ x: number; width: number } | null>(null);
  const selectedOption = layoutOptions.find(
    (option) => option.id === selectedLayout,
  )!;

  const resizeFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (start) {
      setPanelWidth(
        Math.min(360, Math.max(176, start.width + event.clientX - start.x)),
      );
    }
  };

  return (
    <main className="lpl-page">
      <header className="lpl-header">
        <div>
          <a className="lpl-back" href="/identity/design-configurator">
            <ChevronLeft size={15} /> Configurador
          </a>
          <p className="lpl-eyebrow">DESIGN CONFIGURATOR / LAYOUT LAB</p>
          <h1>Layer panel</h1>
          <p className="lpl-intro">
            Cinco formas de ganar espacio sin perder de vista los elementos ni
            sus controles.
          </p>
        </div>
        <span className="lpl-option-count">05 CONCEPTS</span>
      </header>

      <section className="lpl-options" aria-label="Layer panel layout options">
        {layoutOptions.map((option) => (
          <button
            className={`lpl-option${selectedLayout === option.id ? " is-selected" : ""}`}
            key={option.id}
            aria-pressed={selectedLayout === option.id}
            onClick={() => setSelectedLayout(option.id)}
          >
            <div className="lpl-option-title">
              <span>{option.number}</span>
              <h2>{option.title}</h2>
            </div>
            <MiniPanel layout={option.id} />
            <p>{option.description}</p>
          </button>
        ))}
      </section>

      <section className="lpl-demo" aria-labelledby="lpl-demo-title">
        <div className="lpl-demo-heading">
          <div>
            <p className="lpl-eyebrow">
              INTERACTIVE SAMPLE / {selectedOption.number}
            </p>
            <h2 id="lpl-demo-title">{selectedOption.title}</h2>
          </div>
          <p>{selectedOption.description}</p>
        </div>

        <div className="lpl-controls">
          <label className="lpl-width-control">
            Panel width
            <input
              type="range"
              min={176}
              max={360}
              value={panelWidth}
              disabled={collapsed}
              onChange={(event) => setPanelWidth(Number(event.target.value))}
            />
            <output>{collapsed ? 56 : panelWidth}px</output>
          </label>
          <div
            className="lpl-density-control"
            role="group"
            aria-label="Layer density"
          >
            <button aria-pressed={compact} onClick={() => setCompact(true)}>
              Compact
            </button>
            <button aria-pressed={!compact} onClick={() => setCompact(false)}>
              Comfortable
            </button>
          </div>
          <button
            className="lpl-collapse-control"
            aria-label={
              collapsed ? "Expand layer panel" : "Collapse layer panel"
            }
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen size={16} />
            ) : (
              <PanelLeftClose size={16} />
            )}
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>

        <div className={`lpl-workbench${compact ? " is-compact" : ""}`}>
          <aside
            className={`lpl-live-panel${collapsed ? " is-collapsed" : ""}`}
            style={{ width: collapsed ? 56 : panelWidth }}
          >
            <div className="lpl-live-heading">
              <Layers3 size={16} />
              {!collapsed ? (
                <>
                  <strong>Elements</strong>
                  <span>6</span>
                </>
              ) : null}
            </div>
            {!collapsed ? (
              <>
                {selectedLayout === "actions" ? (
                  <div className="lpl-live-actions" aria-label="Layer actions">
                    <button aria-label="Move layer up">
                      <ArrowUp size={14} />
                    </button>
                    <button aria-label="Move layer down">
                      <ArrowDown size={14} />
                    </button>
                    <button aria-label="Duplicate layer">
                      <Copy size={14} />
                    </button>
                    <button aria-label="Delete layer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : null}
                {selectedLayout === "groups" ? (
                  <button
                    className="lpl-accordion"
                    onClick={() => setLayersOpen(!layersOpen)}
                  >
                    <span>LAYERS · SIDE A</span>
                    <ChevronDown
                      size={14}
                      className={layersOpen ? "" : "is-closed"}
                    />
                  </button>
                ) : (
                  <div className="lpl-live-sides">
                    <button aria-pressed="true">Side A</button>
                    <button>Side B</button>
                  </div>
                )}
                {selectedLayout !== "actions" ? (
                  <div className="lpl-live-actions" aria-label="Layer actions">
                    <button aria-label="Move layer up">
                      <ArrowUp size={14} />
                    </button>
                    <button aria-label="Move layer down">
                      <ArrowDown size={14} />
                    </button>
                    <button aria-label="Duplicate layer">
                      <Copy size={14} />
                    </button>
                    <button aria-label="Delete layer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : null}
                {selectedLayout !== "groups" || layersOpen ? (
                  <div className="lpl-live-list">
                    {layerNames.map((name, index) => (
                      <button
                        className={`lpl-live-row${index === 1 ? " is-current" : ""}`}
                        key={name}
                      >
                        <span className="lpl-layer-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <Type size={15} />
                        <span className="lpl-layer-name">
                          {name}
                          <small>Text layer</small>
                        </span>
                        <Eye size={14} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="lpl-collapsed-icons">
                <button aria-label="Layers">
                  <Rows3 size={15} />
                </button>
                <button aria-label="Add text">
                  <Type size={15} />
                </button>
                <button aria-label="Visible layers">
                  <Eye size={15} />
                </button>
              </div>
            )}
          </aside>
          {!collapsed ? (
            <div
              className="lpl-resize-handle"
              role="separator"
              aria-label="Resize layer panel"
              aria-orientation="vertical"
              aria-valuemin={176}
              aria-valuemax={360}
              aria-valuenow={panelWidth}
              tabIndex={0}
              onPointerDown={(event) => {
                dragStart.current = { x: event.clientX, width: panelWidth };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={resizeFromPointer}
              onPointerUp={() => {
                dragStart.current = null;
              }}
              onPointerCancel={() => {
                dragStart.current = null;
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft")
                  setPanelWidth(Math.max(176, panelWidth - 8));
                if (event.key === "ArrowRight")
                  setPanelWidth(Math.min(360, panelWidth + 8));
              }}
            >
              <GripVertical size={14} />
            </div>
          ) : null}
          <div className="lpl-canvas-sample">
            <span>PREVIEW CANVAS</span>
            <div className="lpl-sample-art">
              <strong>
                STRANGE
                <br />
                ANIMALS
              </strong>
              <i>OTHER FREQUENCIES</i>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
