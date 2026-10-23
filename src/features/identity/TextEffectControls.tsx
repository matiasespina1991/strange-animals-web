import { useState } from "react";
import { TypographyValueControl } from "./TypographyValueControl";
import {
  cylinderExtrusionSteps,
  textExtrusion,
  type StaticTextEffect,
  type TextBlendMode,
  type TextExtrusion,
  type TextEffectSettings,
} from "./design-configurator-model";

type Props = {
  effect?: StaticTextEffect;
  settings?: TextEffectSettings;
  onChange: (
    effect?: StaticTextEffect,
    group?: string,
    settings?: TextEffectSettings,
  ) => void;
  onCommit: () => void;
};
const defaultExtrusion: TextExtrusion = {
  depth: 12,
  angle: 45,
  steps: 12,
  fade: 0,
};
const defaultCylinder = {
  type: "cylinder" as const,
  radius: 170,
  span: 150,
  segments: 24,
  tilt: 0,
  rotation: 0,
};

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

export function TextEffectControls({
  effect,
  settings,
  onChange,
  onCommit,
}: Props) {
  const [activeEffect, setActiveEffect] = useState<"cylinder" | "extrusion">(
    effect?.type === "extrusion" ? "extrusion" : "cylinder",
  );
  const cylinder = effect?.type === "cylinder" ? effect : undefined;
  const extrusion = textExtrusion(effect);
  const maxSteps = cylinder ? cylinderExtrusionSteps(cylinder.segments) : 200;
  const { extrusion: _activeExtrusion, ...activeCylinder } = cylinder ?? {
    ...defaultCylinder,
    extrusion: undefined,
  };
  const remembered = {
    cylinder: settings?.cylinder ?? activeCylinder,
    extrusion: settings?.extrusion ?? extrusion ?? defaultExtrusion,
  };
  const apply = (
    cylinderEnabled: boolean,
    extrusionEnabled: boolean,
    next = remembered,
    group?: string,
  ) => {
    const restoredExtrusion = cylinderEnabled
      ? {
          ...next.extrusion,
          steps: Math.min(
            next.extrusion.steps,
            cylinderExtrusionSteps(next.cylinder.segments),
          ),
        }
      : next.extrusion;
    onChange(
      cylinderEnabled
        ? {
            ...next.cylinder,
            ...(extrusionEnabled ? { extrusion: restoredExtrusion } : {}),
          }
        : extrusionEnabled
          ? { type: "extrusion", ...restoredExtrusion }
          : undefined,
      group,
      next,
    );
  };
  const toggleCylinder = (enabled: boolean) => {
    apply(enabled, Boolean(extrusion));
  };
  const toggleExtrusion = (enabled: boolean) => {
    apply(Boolean(cylinder), enabled);
  };
  const updateExtrusion = (patch: Partial<TextExtrusion>) => {
    if (!extrusion) return;
    apply(
      Boolean(cylinder),
      true,
      { ...remembered, extrusion: { ...remembered.extrusion, ...patch } },
      "text-extrusion",
    );
  };
  const updateCylinder = (
    patch: Partial<Extract<StaticTextEffect, { type: "cylinder" }>>,
  ) => {
    if (!cylinder) return;
    const { extrusion: _extrusion, ...next } = { ...cylinder, ...patch };
    apply(
      true,
      Boolean(extrusion),
      { ...remembered, cylinder: next },
      "text-cylinder",
    );
  };

  return (
    <div className="dc-text-effects" role="group" aria-label="3D effects">
      <div className="dc-effect-tabs" role="group" aria-label="Effect settings">
        <div
          className="dc-effect-tab"
          data-active={activeEffect === "cylinder"}
        >
          <button
            type="button"
            aria-label="Show Cylinder controls"
            aria-pressed={activeEffect === "cylinder"}
            data-effect-tab="cylinder"
            onClick={() => setActiveEffect("cylinder")}
          >
            Cylinder
          </button>
          <input
            className="dc-effect-enable"
            type="checkbox"
            aria-label="Enable Cylinder"
            checked={Boolean(cylinder)}
            onChange={(event) => {
              setActiveEffect("cylinder");
              toggleCylinder(event.target.checked);
            }}
          />
        </div>
        <div
          className="dc-effect-tab"
          data-active={activeEffect === "extrusion"}
        >
          <button
            type="button"
            aria-label="Show Extrusion controls"
            aria-pressed={activeEffect === "extrusion"}
            data-effect-tab="extrusion"
            onClick={() => setActiveEffect("extrusion")}
          >
            Extrusion
          </button>
          <input
            className="dc-effect-enable"
            type="checkbox"
            aria-label="Enable Extrusion"
            checked={Boolean(extrusion)}
            onChange={(event) => {
              setActiveEffect("extrusion");
              toggleExtrusion(event.target.checked);
            }}
          />
        </div>
      </div>
      {activeEffect === "cylinder" && cylinder && (
        <section
          role="tabpanel"
          id="dc-cylinder-panel"
          aria-label="Cylinder settings"
        >
          <>
            <div className="dc-cylinder-actions">
              <button
                type="button"
                aria-pressed={Boolean(cylinder.closed)}
                className="dc-cylinder-close"
                onClick={() => {
                  onCommit();
                  apply(true, Boolean(extrusion), {
                    ...remembered,
                    cylinder: {
                      ...remembered.cylinder,
                      closed: !cylinder.closed,
                    },
                  });
                }}
              >
                {cylinder.closed ? "Open cylinder" : "Close cylinder"}
              </button>
              <small>
                {cylinder.closed ? "360° · repeating text" : "Open arc"}
              </small>
            </div>
            <div className="dc-effect-grid">
              <TypographyValueControl
                label="Tilt"
                unit="°"
                min={-75}
                max={75}
                value={cylinder.tilt ?? 0}
                step={1}
                onChange={(tilt) => updateCylinder({ tilt })}
                onCommit={onCommit}
              />
              <TypographyValueControl
                label="Rotation"
                unit="°"
                min={0}
                max={360}
                value={cylinder.rotation ?? 0}
                step={1}
                onChange={(rotation) => updateCylinder({ rotation })}
                onCommit={onCommit}
              />
              <TypographyValueControl
                label="Radius"
                unit="PX"
                min={30}
                max={295}
                value={cylinder.radius}
                step={1}
                onChange={(radius) => updateCylinder({ radius })}
                onCommit={onCommit}
              />
              {!cylinder.closed && (
                <TypographyValueControl
                  label="Max arc"
                  unit="°"
                  min={1}
                  max={180}
                  value={cylinder.span}
                  step={1}
                  onChange={(span) => updateCylinder({ span })}
                  onCommit={onCommit}
                />
              )}
              <TypographyValueControl
                label="Segments"
                min={6}
                max={64}
                value={cylinder.segments}
                step={1}
                onChange={(segments) =>
                  updateCylinder({ segments: Math.round(segments) })
                }
                onCommit={onCommit}
              />
            </div>
            <TypographyValueControl
              label="Back blur"
              unit="PX"
              min={0}
              max={40}
              value={cylinder.backBlur ?? 0}
              step={0.1}
              onChange={(backBlur) => updateCylinder({ backBlur })}
              onCommit={onCommit}
            />
            <TypographyValueControl
              label="Back shading"
              unit="%"
              min={0}
              max={250}
              sliderMax={100}
              value={cylinder.backShading ?? 70}
              step={1}
              onChange={(backShading) => updateCylinder({ backShading })}
              onCommit={onCommit}
            />
            <TypographyValueControl
              label="Back transparency"
              unit="%"
              min={0}
              max={400}
              sliderMax={100}
              value={cylinder.backFade ?? 0}
              step={1}
              onChange={(backFade) => updateCylinder({ backFade })}
              onCommit={onCommit}
            />
          </>
        </section>
      )}
      {activeEffect === "extrusion" && extrusion && (
        <section
          role="tabpanel"
          id="dc-extrusion-panel"
          aria-label="Extrusion settings"
        >
          <>
            <div className="dc-effect-grid">
              <TypographyValueControl
                label="Depth"
                unit="PX"
                min={1}
                max={400}
                value={extrusion.depth}
                step={0.5}
                onChange={(depth) => updateExtrusion({ depth })}
                onCommit={onCommit}
              />
              <TypographyValueControl
                label="Direction"
                unit="°"
                min={0}
                max={360}
                value={extrusion.angle}
                step={1}
                onChange={(angle) => updateExtrusion({ angle })}
                onCommit={onCommit}
              />
              <TypographyValueControl
                label="Steps"
                min={1}
                max={maxSteps}
                value={Math.min(extrusion.steps, maxSteps)}
                step={1}
                onChange={(steps) =>
                  updateExtrusion({ steps: Math.round(steps) })
                }
                onCommit={onCommit}
              />
              <TypographyValueControl
                label="Fade"
                unit="%"
                min={0}
                max={300}
                sliderMax={100}
                value={extrusion.fade ?? 0}
                step={1}
                onChange={(fade) => updateExtrusion({ fade })}
                onCommit={onCommit}
              />
            </div>
            <TypographyValueControl
              label="Depth blur"
              unit="PX"
              min={0}
              max={40}
              value={extrusion.depthBlur ?? 0}
              step={0.1}
              onChange={(depthBlur) => updateExtrusion({ depthBlur })}
              onCommit={onCommit}
            />
          </>
        </section>
      )}
    </div>
  );
}
