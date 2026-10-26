import { useState } from "react";
import { ArrowLeft, Box, Check, Disc3, Focus, Grid2X2, Layers3, Minus, Plus } from "lucide-react";
import { DESIGN_COLOR_PRESETS } from "./design-configurator-colors";
import { SleeveSurfaceIcon } from "./SleeveSurfaceIcon";
import "./configurator-controls-lab.css";

type Surface = "cookie" | "sleeve";

const switchConcepts = [
  { id: "segment", title: "Segment", detail: "Compact, direct choice." },
  { id: "slider", title: "Sliding switch", detail: "A single control with a clear state." },
  { id: "tiles", title: "Surface tiles", detail: "Names and shapes stay visible." },
  { id: "stack", title: "Vertical list", detail: "Room for a future third surface." },
  { id: "rail", title: "Icon rail", detail: "A visual choice with short labels." },
  { id: "inline", title: "Inline modes", detail: "Surface and A/B in one compact sidebar." },
] as const;

const colorConcepts = [
  { id: "current", title: "Current families", detail: "Preserve the existing curated order." },
  { id: "hue", title: "Hue wheel", detail: "Move steadily around the spectrum." },
  { id: "temperature", title: "Warm to cool", detail: "Group by perceived temperature." },
  { id: "lightness", title: "Light to dark", detail: "Scan from pale tints to deep inks." },
  { id: "chroma", title: "Muted to vivid", detail: "Four neutrals first, then vivid colors from light to dark." },
  { id: "contrast", title: "Alternating value", detail: "Light and dark swatches stay distinct." },
] as const;

function hsl(hex: string) {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((value) => parseInt(value, 16) / 255) ?? [0, 0, 0];
  const [red, green, blue] = channels;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const lightness = (max + min) / 2;
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return { hue, saturation, lightness, luminance };
}

const indexedColors = DESIGN_COLOR_PRESETS.map((color, index) => ({
  color,
  index,
  ...hsl(color),
}));

function orderedColors(order: (typeof colorConcepts)[number]["id"]) {
  const colors = [...indexedColors];
  const neutralLast = (a: (typeof colors)[number], b: (typeof colors)[number]) =>
    Number(a.saturation < 0.12) - Number(b.saturation < 0.12);
  if (order === "hue") {
    colors.sort((a, b) => neutralLast(a, b) || a.hue - b.hue || a.lightness - b.lightness);
  } else if (order === "temperature") {
    const temperature = (hue: number) =>
      hue < 75 || hue >= 330 ? 0 : hue < 165 ? 1 : hue < 255 ? 2 : 3;
    colors.sort((a, b) => neutralLast(a, b) || temperature(a.hue) - temperature(b.hue) || a.hue - b.hue);
  } else if (order === "lightness") {
    colors.sort((a, b) => a.lightness - b.lightness || a.hue - b.hue);
  } else if (order === "chroma") {
    const neutralOrder = ["#FFFFFF", "#000000", "#656765", "#2F2D2E"];
    const neutrals = neutralOrder.flatMap((color) =>
      colors.filter((entry) => entry.color.toUpperCase() === color),
    );
    const remaining = colors.filter(
      (entry) => !neutralOrder.includes(entry.color.toUpperCase()),
    );
    const vividness = (entry: (typeof colors)[number]) =>
      entry.saturation * 0.75 + entry.lightness * 0.25;
    remaining.sort(
      (a, b) => vividness(b) - vividness(a) || b.luminance - a.luminance,
    );
    return [...neutrals, ...remaining];
  } else if (order === "contrast") {
    colors.sort((a, b) => a.luminance - b.luminance || a.index - b.index);
    const alternating: typeof colors = [];
    let low = 0;
    let high = colors.length - 1;
    while (low <= high) {
      alternating.push(colors[low++]);
      if (low <= high) alternating.push(colors[high--]);
    }
    return alternating;
  }
  return colors;
}

function SurfacePair({
  mode,
  concept,
  onChange,
}: {
  mode: Surface;
  concept: (typeof switchConcepts)[number]["id"];
  onChange: (mode: Surface) => void;
}) {
  const cookie = mode === "cookie";
  return (
    <div className={`cc-switch cc-switch-${concept}`}>
      {concept === "stack" ? (
        <>
          <button type="button" aria-pressed={cookie} onClick={() => onChange("cookie")}><Disc3 size={15} /> Cookie</button>
          <button type="button" aria-pressed={!cookie} onClick={() => onChange("sleeve")}><SleeveSurfaceIcon size={15} /> Sleeve</button>
        </>
      ) : concept === "rail" ? (
        <>
          <button type="button" aria-pressed={cookie} onClick={() => onChange("cookie")}><Disc3 size={17} /><span>Cookie</span></button>
          <button type="button" aria-pressed={!cookie} onClick={() => onChange("sleeve")}><SleeveSurfaceIcon size={17} /><span>Sleeve</span></button>
        </>
      ) : (
        <>
          <button type="button" aria-pressed={cookie} onClick={() => onChange("cookie")}>
            {concept === "tiles" && <Disc3 size={15} />}
            {concept === "inline" ? "Cookie" : "Cookie"}
            {cookie && concept === "tiles" && <Check size={13} />}
          </button>
          <button type="button" aria-pressed={!cookie} onClick={() => onChange("sleeve")}>
            {concept === "tiles" && <SleeveSurfaceIcon size={15} />}
            {concept === "inline" ? "Sleeve" : "Sleeve"}
            {!cookie && concept === "tiles" && <Check size={13} />}
          </button>
        </>
      )}
      {concept === "slider" && <span className={`cc-slider-thumb${cookie ? " is-cookie" : ""}`} />}
    </div>
  );
}

function SidePair({ side, onChange }: { side: "A" | "B"; onChange: (side: "A" | "B") => void }) {
  return (
    <div className="cc-side-pair" role="group" aria-label="Side">
      {(["A", "B"] as const).map((value) => (
        <button
          type="button"
          key={value}
          aria-pressed={side === value}
          onClick={() => onChange(value)}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

export default function ConfiguratorControlsLabPage() {
  const [surfaces, setSurfaces] = useState<Record<string, Surface>>(
    Object.fromEntries(switchConcepts.map(({ id }) => [id, "cookie"])),
  );
  const [sides, setSides] = useState<Record<string, "A" | "B">>(
    Object.fromEntries(switchConcepts.map(({ id }) => [id, "A"])),
  );
  const [selectedOrder, setSelectedOrder] = useState("current");

  return (
    <main className="cc-page">
      <header className="cc-header">
        <a href="/identity/design-configurator"><ArrowLeft size={16} /> Back to configurator</a>
        <a className="cc-header-mobile-link" href="/dev/configurator-mobile-sketch">Mobile layout study <ArrowLeft size={14} /></a>
        <span>DEVELOPMENT / IDENTITY / CONTROL STUDY</span>
      </header>
      <div className="cc-main">
        <div className="cc-intro">
          <div>
            <p className="cc-kicker">DESIGN CONFIGURATOR · INTERACTION STUDY</p>
            <h1>Surface & color controls</h1>
            <p>Twelve directions for switching between Cookie and Sleeve, and finding a color.</p>
          </div>
          <span className="cc-count">06 × 06<br /><b>CONCEPTS</b></span>
        </div>

        <section className="cc-section" aria-labelledby="cc-surface-heading">
          <div className="cc-section-head">
            <span>01</span><h2 id="cc-surface-heading">Choose a surface</h2><p>Six ways to switch surfaces, with A/B shown as a separate control.</p>
          </div>
          <div className="cc-switch-grid">
            {switchConcepts.map((concept, index) => (
              <article className="cc-concept" key={concept.id}>
                <header><span>0{index + 1}</span><h3>{concept.title}</h3></header>
                <p>{concept.detail}</p>
                <div className={`cc-editor-demo cc-editor-${concept.id}`}>
                  <aside className="cc-left-panel">
                    <span className="cc-left-title"><Layers3 size={11} /> Elements</span>
                    <SidePair
                      side={sides[concept.id]}
                      onChange={(side) => setSides((current) => ({ ...current, [concept.id]: side }))}
                    />
                    <SurfacePair
                      concept={concept.id}
                      mode={surfaces[concept.id]}
                      onChange={(mode) => setSurfaces((current) => ({ ...current, [concept.id]: mode }))}
                    />
                    <div className="cc-add-sample" aria-hidden="true">
                      <span>Text</span><span>Image</span><span>Arc text</span><span>Assets</span>
                    </div>
                    <div className="cc-layer-sample" aria-hidden="true">
                      <span><Disc3 size={10} /> Artist</span>
                      <span><Layers3 size={10} /> Artwork</span>
                    </div>
                  </aside>
                  <div className="cc-preview-area">
                    <div className="cc-preview-toolbar">
                      <span className="cc-preview-tag">
                        {surfaces[concept.id] === "cookie" ? <Disc3 size={12} /> : <SleeveSurfaceIcon size={12} />}
                        PREVIEW
                      </span>
                      <div className="cc-toolbar-tools" aria-hidden="true">
                        <span className="cc-tool-check"><i /> Frame</span>
                        <span className="cc-tool-3d"><Box size={12} /> 3D</span>
                        <span className="cc-tool-zoom"><Minus size={11} /><b>100%</b><Plus size={11} /></span>
                        <span className="cc-tool-guides"><Grid2X2 size={11} /> Guides</span>
                        <Focus className="cc-tool-focus" size={12} />
                      </div>
                    </div>
                    <div className="cc-mini-canvas" aria-hidden="true">
                      <span className="cc-mini-record"><Disc3 size={28} /><b>LABEL</b></span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="cc-section cc-color-section" aria-labelledby="cc-color-heading">
          <div className="cc-section-head">
            <span>02</span><h2 id="cc-color-heading">Organize the colors</h2><p>{DESIGN_COLOR_PRESETS.length} real configurator swatches, reordered for comparison.</p>
          </div>
          <div className="cc-color-grid">
            {colorConcepts.map((concept, index) => {
              const colors = orderedColors(concept.id).slice(0, 36);
              return (
                <button
                  type="button"
                  className={`cc-color-concept${selectedOrder === concept.id ? " is-selected" : ""}`}
                  key={concept.id}
                  aria-pressed={selectedOrder === concept.id}
                  onClick={() => setSelectedOrder(concept.id)}
                >
                  <span className="cc-color-heading"><b>0{index + 1}</b><strong>{concept.title}</strong>{selectedOrder === concept.id && <Check size={14} />}</span>
                  <span className="cc-color-swatches">
                    {colors.map(({ color, index: colorIndex }) => <i key={`${color}-${colorIndex}`} title={color} style={{ backgroundColor: color }} />)}
                  </span>
                  <span className="cc-color-detail">{concept.detail}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}