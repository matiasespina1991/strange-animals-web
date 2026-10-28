import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
const compile = (source, jsx = false) =>
  ts.transpileModule(source, {
    fileName: jsx ? "test.tsx" : "test.ts",
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;
const model = {};
vm.runInNewContext(
  compile(
    readFileSync("src/features/identity/design-configurator-model.ts", "utf8"),
  ),
  { exports: model },
);
const controls = {};
vm.runInNewContext(
  compile(
    readFileSync("src/features/identity/TextEffectControls.tsx", "utf8"),
    true,
  ),
  {
    exports: controls,
    React,
    require: (path) =>
      path === "react"
        ? {
            useState: (initial) => [
              activeEffectTab ?? (activeEffectTab = initial),
              (value) => {
                activeEffectTab =
                  typeof value === "function" ? value(activeEffectTab) : value;
              },
            ],
          }
        : path.includes("design-configurator-model")
          ? model
          : { TypographyValueControl: () => null },
  },
);
const surfaceControls = {};
vm.runInNewContext(
  compile(
    readFileSync("src/features/identity/TextSurfaceControl.tsx", "utf8"),
    true,
  ),
  {
    exports: surfaceControls,
    React: {
      createElement: React.createElement,
      useRef: () => ({ current: null }),
    },
    require: (path) =>
      path === "react"
        ? { useRef: () => ({ current: null }) }
        : path.includes("lucide-react")
          ? { ImagePlus: "ImagePlus", X: "X" }
          : { TypographyValueControl: () => null },
  },
);
let effect, group, settings, activeEffectTab;
const render = () =>
  controls.TextEffectControls({
    effect,
    settings,
    onChange: (value, key, nextSettings) => {
      effect = value;
      group = key;
      settings = nextSettings;
    },
    onCommit: () => {},
  });
const elements = (element) => {
  if (!element || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap(elements);
  return [element, ...elements(element.props?.children)];
};
const surfaceChanges = [];
const surfaceElements = elements(
  surfaceControls.TextSurfaceControl({
    layerId: "text-1",
    image: "data:image/png;base64,aGVsbG8=",
    opacity: 0.6,
    scale: 125,
    onChange: (patch, key) => surfaceChanges.push({ patch, key }),
    onCommit: () => {},
    onError: () => {},
  }),
);
assert.equal(
  surfaceElements.find(
    (element) => element.type === "input" && element.props.type === "file",
  ).props.accept,
  "image/png,image/jpeg,image/webp",
);
const textureScale = surfaceElements.find(
  (element) => element.props?.label === "Texture scale",
);
assert.equal(textureScale.props.max, 400);
textureScale.props.onChange(175);
assert.deepEqual(JSON.parse(JSON.stringify(surfaceChanges[0])), {
  patch: { textTextureScale: 175 },
  key: "text-surface-scale-text-1",
});
surfaceElements
  .find((element) => element.props?.label === "Texture opacity")
  .props.onChange(35);
assert.deepEqual(JSON.parse(JSON.stringify(surfaceChanges[1])), {
  patch: { textTextureOpacity: 0.35 },
  key: "text-surface-opacity-text-1",
});
surfaceElements
  .find(
    (element) => element.props?.["aria-label"] === "Remove text surface image",
  )
  .props.onClick();
assert.ok(Object.hasOwn(surfaceChanges[2].patch, "textTexture"));
assert.ok(Object.hasOwn(surfaceChanges[2].patch, "textTextureOpacity"));
assert.ok(Object.hasOwn(surfaceChanges[2].patch, "textTextureScale"));
assert.equal(surfaceChanges[2].patch.textTexture, undefined);
assert.equal(surfaceChanges[2].patch.textTextureOpacity, undefined);
assert.equal(surfaceChanges[2].patch.textTextureScale, undefined);
const selectTab = (name) =>
  elements(render())
    .find((e) => e.props?.["data-effect-tab"] === name)
    .props.onClick();
const toggle = (index, checked) => {
  const name = index === 0 ? "Cylinder" : "Extrusion";
  elements(render())
    .find(
      (e) => e.type === "input" && e.props["aria-label"] === `Enable ${name}`,
    )
    .props.onChange({ target: { checked } });
};
const selectedTab = (name) =>
  elements(render()).find((e) => e.props?.["data-effect-tab"] === name).props[
    "aria-pressed"
  ];
const currentPanel = () =>
  elements(render()).find((e) => e.props?.role === "tabpanel");
toggle(0, true);
assert.equal(effect.type, "cylinder");
assert.equal(
  selectedTab("cylinder"),
  true,
  "Enabling an effect selects its controls",
);
assert.equal(currentPanel().props.id, "dc-cylinder-panel");
toggle(1, true);
assert.equal(effect.type, "cylinder");
assert.equal(effect.extrusion.steps, 12);
assert.equal(
  selectedTab("extrusion"),
  true,
  "Enabling the other effect selects its controls",
);
assert.equal(currentPanel().props.id, "dc-extrusion-panel");
selectTab("cylinder");
assert.equal(
  effect.type,
  "cylinder",
  "Switching tabs must not disable an effect",
);
assert.equal(currentPanel().props.id, "dc-cylinder-panel");
selectTab("extrusion");
assert.equal(
  effect.type,
  "cylinder",
  "Both effects remain active across tab switches",
);
const fade = elements(render()).find((e) => e.props?.label === "Fade");
assert.equal(fade.props.max, 300);
assert.equal(fade.props.sliderMax, 100);
fade.props.onChange(75);
assert.equal(effect.extrusion.fade, 75);
assert.equal(group, "text-extrusion");
const depthBlur = elements(render()).find(
  (e) => e.props?.label === "Depth blur",
);
assert.equal(depthBlur.props.max, 40);
depthBlur.props.onChange(12);
assert.equal(effect.extrusion.depthBlur, 12);
toggle(0, false);
assert.equal(effect.type, "extrusion");
assert.equal(
  currentPanel(),
  undefined,
  "Disabled effects do not leave an empty settings panel open",
);
assert.equal(
  effect.fade,
  75,
  "Turning cylinder off preserves extrusion settings",
);
assert.equal(effect.depthBlur, 12);
toggle(0, true);
assert.equal(effect.extrusion.fade, 75);
assert.equal(effect.extrusion.depthBlur, 12);
assert.equal(
  effect.extrusion.type,
  undefined,
  "Nested settings must not contain a stale discriminator",
);
toggle(1, false);
assert.equal(effect.type, "cylinder");
assert.equal(
  effect.extrusion,
  undefined,
  "Turning extrusion off preserves cylinder settings",
);
toggle(0, false);
assert.equal(effect, undefined);
effect = { type: "extrusion", depth: 15, angle: 30, steps: 200, fade: 50 };
settings = undefined;
toggle(0, true);
assert.ok(
  effect.extrusion.steps <= model.cylinderExtrusionSteps(effect.segments),
);
const originalSpan = effect.span;
const closeCylinder = () =>
  elements(render())
    .find((e) => e.props?.className === "dc-cylinder-close")
    .props.onClick();
assert.equal(effect.closed, true, "New cylinders start closed");
closeCylinder();
assert.equal(effect.closed, false, "User can open the cylinder");
closeCylinder();
assert.equal(effect.closed, true);
assert.equal(effect.span, originalSpan);
assert.equal(
  elements(render()).find((e) => e.props?.label === "Max arc"),
  undefined,
);
const backBlur = elements(render()).find((e) => e.props?.label === "Back blur");
assert.equal(backBlur.props.max, 40);
backBlur.props.onChange(20);
assert.equal(effect.backBlur, 20);
assert.equal(group, "text-cylinder");
closeCylinder();
assert.equal(effect.closed, false);
assert.equal(effect.span, originalSpan);
assert.equal(effect.backBlur, 20);
assert.ok(elements(render()).find((e) => e.props?.label === "Max arc"));
const preferredExtrusion = structuredClone(settings.extrusion);
const preferredCylinder = structuredClone(settings.cylinder);
toggle(0, false);
assert.equal(effect.type, "extrusion");
assert.equal(
  effect.steps,
  200,
  "Turning cylinder off restores the requested steps before the combined rendering cap",
);
toggle(1, false);
assert.equal(effect, undefined);
assert.deepEqual(
  JSON.parse(JSON.stringify(settings.extrusion)),
  preferredExtrusion,
);
assert.deepEqual(
  JSON.parse(JSON.stringify(settings.cylinder)),
  preferredCylinder,
);
toggle(0, true);
assert.equal(effect.backBlur, 20);
assert.equal(effect.span, preferredCylinder.span);
toggle(1, true);
assert.equal(effect.extrusion.fade, 50);
assert.equal(effect.extrusion.depth, 15);
toggle(1, false);
toggle(1, true);
assert.equal(effect.extrusion.fade, 50);
assert.equal(effect.extrusion.depth, 15);
const cylinderFields = new Set([
  "Tilt",
  "Rotation",
  "Radius",
  "Max arc",
  "Segments",
  "Back blur",
  "Back shading",
  "Back transparency",
]);
const edit = (label, value) => {
  selectTab(cylinderFields.has(label) ? "cylinder" : "extrusion");
  elements(render())
    .find((e) => e.props?.label === label)
    .props.onChange(value);
};
edit("Radius", 220);
assert.equal(
  elements(render()).find((e) => e.props?.label === "Back shading").props.max,
  250,
);
assert.equal(
  elements(render()).find((e) => e.props?.label === "Back shading").props
    .sliderMax,
  100,
);
edit("Back shading", 250);
assert.equal(
  elements(render()).find((e) => e.props?.label === "Back transparency").props
    .max,
  400,
);
assert.equal(
  elements(render()).find((e) => e.props?.label === "Back transparency").props
    .sliderMax,
  100,
);
edit("Back transparency", 400);
edit("Tilt", -35);
edit("Rotation", 180);
assert.equal(effect.rotation, 180);
edit("Depth blur", 17);
edit("Fade", 250);
selectTab("cylinder");
closeCylinder();
assert.equal(effect.closed, true);
toggle(0, false);
toggle(1, false);
const savedSettings = structuredClone(settings);
settings = JSON.parse(JSON.stringify(settings));
toggle(0, true);
toggle(1, true);
assert.equal(effect.radius, 220);
assert.equal(effect.backShading, 250);
assert.equal(effect.backFade, 400);
assert.equal(effect.tilt, -35);
assert.equal(effect.rotation, 180);
assert.equal(effect.closed, true);
assert.equal(effect.backBlur, 20);
assert.equal(effect.extrusion.depthBlur, 17);
assert.equal(effect.extrusion.fade, 250);
assert.deepEqual(JSON.parse(JSON.stringify(settings)), savedSettings);
// A different element without saved settings must start with its own defaults.
effect = undefined;
settings = undefined;
toggle(0, true);
assert.equal(effect.radius, 170);
assert.equal(effect.closed, true);
console.log(
  "Effect controls: independent toggles, combined mode, fade edits, settings preservation and performance limits passed.",
);
