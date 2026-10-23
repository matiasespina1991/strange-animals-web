import { TypographyValueControl } from "./TypographyValueControl";
import { cylinderExtrusionSteps, textExtrusion, type StaticTextEffect, type TextBlendMode, type TextExtrusion, type TextEffectSettings } from "./design-configurator-model";

type Props = {
  effect?: StaticTextEffect;
  settings?: TextEffectSettings;
  onChange: (effect?: StaticTextEffect, group?: string, settings?: TextEffectSettings) => void;
  onCommit: () => void;
};
const defaultExtrusion: TextExtrusion = { depth: 12, angle: 45, steps: 12, fade: 0 };
const defaultCylinder = { type: "cylinder" as const, radius: 170, span: 150, segments: 24, tilt: 0, rotation: 0 };

export function TextBlendModeControl({
  value,
  onChange,
}: {
  value?: TextBlendMode;
  onChange: (value?: TextBlendMode) => void;
}) {
  return (
    <label className="dc-field">
      <span>Text contrast</span>
      <select
        value={value ?? "normal"}
        onChange={(event) =>
          onChange(
            event.target.value === "difference" ? "difference" : undefined,
          )
        }
      >
        <option value="normal">Normal</option>
        <option value="difference">Invert backdrop (Difference)</option>
      </select>
    </label>
  );
}

export function TextEffectControls({ effect, settings, onChange, onCommit }: Props) {
  const cylinder = effect?.type === "cylinder" ? effect : undefined;
  const extrusion = textExtrusion(effect);
  const maxSteps = cylinder ? cylinderExtrusionSteps(cylinder.segments) : 200;
  const { extrusion: _activeExtrusion, ...activeCylinder } = cylinder ?? { ...defaultCylinder, extrusion: undefined };
  const remembered = {
    cylinder: settings?.cylinder ?? activeCylinder,
    extrusion: settings?.extrusion ?? extrusion ?? defaultExtrusion,
  };
  const apply = (cylinderEnabled: boolean, extrusionEnabled: boolean, next = remembered, group?: string) => {
    const restoredExtrusion = cylinderEnabled
      ? { ...next.extrusion, steps: Math.min(next.extrusion.steps, cylinderExtrusionSteps(next.cylinder.segments)) }
      : next.extrusion;
    onChange(cylinderEnabled
      ? { ...next.cylinder, ...(extrusionEnabled ? { extrusion: restoredExtrusion } : {}) }
      : extrusionEnabled ? { type: "extrusion", ...restoredExtrusion } : undefined,
    group, next);
  };
  const toggleCylinder = (enabled: boolean) => {
    apply(enabled, Boolean(extrusion));
  };
  const toggleExtrusion = (enabled: boolean) => {
    apply(Boolean(cylinder), enabled);
  };
  const updateExtrusion = (patch: Partial<TextExtrusion>) => {
    if (!extrusion) return;
    apply(Boolean(cylinder), true, { ...remembered, extrusion: { ...remembered.extrusion, ...patch } }, "text-extrusion");
  };
  const updateCylinder = (patch: Partial<Extract<StaticTextEffect, { type: "cylinder" }>>) => {
    if (!cylinder) return;
    const { extrusion: _extrusion, ...next } = { ...cylinder, ...patch };
    apply(true, Boolean(extrusion), { ...remembered, cylinder: next }, "text-cylinder");
  };

  return <div className="dc-text-effects" role="group" aria-label="3D effects">
    <span className="dc-effect-title">3D effects</span>
    <section>
      <label className="dc-effect-toggle">
        <input type="checkbox" checked={Boolean(cylinder)} onChange={event => toggleCylinder(event.target.checked)} />
        Cylinder
      </label>
      {cylinder && <>
      <div className="dc-cylinder-actions">
        <button type="button" aria-pressed={Boolean(cylinder.closed)} className="dc-cylinder-close" onClick={() => { onCommit(); apply(true, Boolean(extrusion), { ...remembered, cylinder: { ...remembered.cylinder, closed: !cylinder.closed } }); }}>
          {cylinder.closed ? "Open cylinder" : "Close cylinder"}
        </button>
        <small>{cylinder.closed ? "360° · repeating text" : "Open arc"}</small>
      </div>
      <div className="dc-effect-grid">
        <TypographyValueControl label="Tilt" unit="°" min={-75} max={75} value={cylinder.tilt ?? 0} step={1} onChange={tilt => updateCylinder({ tilt })} onCommit={onCommit} />
        <TypographyValueControl label="Rotation" unit="°" min={0} max={360} value={cylinder.rotation ?? 0} step={1} onChange={rotation => updateCylinder({ rotation })} onCommit={onCommit} />
        <TypographyValueControl label="Radius" unit="PX" min={30} max={295} value={cylinder.radius} step={1} onChange={radius => updateCylinder({ radius })} onCommit={onCommit} />
        {!cylinder.closed && <TypographyValueControl label="Max arc" unit="°" min={1} max={180} value={cylinder.span} step={1} onChange={span => updateCylinder({ span })} onCommit={onCommit} />}
        <TypographyValueControl label="Segments" min={6} max={64} value={cylinder.segments} step={1} onChange={segments => updateCylinder({ segments: Math.round(segments) })} onCommit={onCommit} />
      </div>
      <TypographyValueControl label="Back blur" unit="PX" min={0} max={40} value={cylinder.backBlur ?? 0} step={0.1} onChange={backBlur => updateCylinder({ backBlur })} onCommit={onCommit} />
      <p className="dc-effect-hint">Softens the farthest panels while keeping the front in focus.</p>
      <TypographyValueControl label="Back shading" unit="%" min={0} max={250} sliderMax={100} value={cylinder.backShading ?? 70} step={1} onChange={backShading => updateCylinder({ backShading })} onCommit={onCommit} />
      <p className="dc-effect-hint">Darkens the farthest panels. 0% keeps their original color.</p>
      <TypographyValueControl label="Back transparency" unit="%" min={0} max={400} sliderMax={100} value={cylinder.backFade ?? 0} step={1} onChange={backFade => updateCylinder({ backFade })} onCommit={onCommit} />
      <p className="dc-effect-hint">Progressively fades toward the back. 0% keeps every panel opaque.</p>
      </>}
    </section>
    <section>
      <label className="dc-effect-toggle">
        <input type="checkbox" checked={Boolean(extrusion)} onChange={event => toggleExtrusion(event.target.checked)} />
        Extrusion
      </label>
      {extrusion && <>
        <div className="dc-effect-grid">
          <TypographyValueControl label="Depth" unit="PX" min={1} max={400} value={extrusion.depth} step={0.5} onChange={depth => updateExtrusion({ depth })} onCommit={onCommit} />
          <TypographyValueControl label="Direction" unit="°" min={0} max={360} value={extrusion.angle} step={1} onChange={angle => updateExtrusion({ angle })} onCommit={onCommit} />
          <TypographyValueControl label="Steps" min={1} max={maxSteps} value={Math.min(extrusion.steps, maxSteps)} step={1} onChange={steps => updateExtrusion({ steps: Math.round(steps) })} onCommit={onCommit} />
          <TypographyValueControl label="Fade" unit="%" min={0} max={300} sliderMax={100} value={extrusion.fade ?? 0} step={1} onChange={fade => updateExtrusion({ fade })} onCommit={onCommit} />
        </div>
        <TypographyValueControl label="Depth blur" unit="PX" min={0} max={40} value={extrusion.depthBlur ?? 0} step={0.1} onChange={depthBlur => updateExtrusion({ depthBlur })} onCommit={onCommit} />
        <p className="dc-effect-hint">Depth blur softens distant copies progressively. The front face stays sharp.</p>
        <p className="dc-effect-hint">0% keeps copies opaque; 100% fades out the farthest. Enter up to 300% for faster fading. The front stays opaque.</p>
        {cylinder && <p className="dc-effect-hint">Up to {maxSteps} depth steps with {cylinder.segments} segments to keep editing responsive.</p>}
      </>}
    </section>
  </div>;
}
