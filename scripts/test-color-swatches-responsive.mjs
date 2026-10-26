import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as icons from "lucide-react";
import postcss from "postcss";
const compile = file => ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
const load = file => { const exports = {}; vm.runInNewContext(compile(file), { exports }); return exports; };
const capacity = load("src/features/identity/color-swatch-capacity.ts");
const palettes = load("src/features/identity/design-configurator-colors.ts");
const { colorSwatchCapacity: fit } = capacity;
assert.equal(fit(247, 22, 4, 26, 4, 100), 8);
assert.equal(fit(378, 22, 4, 26, 4, 100), 13);
assert.equal(fit(200, 22, 4, 26, 4, 3), 3);
assert.equal(fit(0, 22, 4, 26, 4, 100), 0);
for (let width = 100; width <= 600; width++) {
  const count = fit(width, 22, 4, 26, 4, 100);
  assert.ok(count <= 14);
  assert.ok(count * 22 + (count - 1) * 4 + 26 + 4 <= width);
}
assert.equal(new Set(palettes.INK_COLOR_PRESETS).size, palettes.INK_COLOR_PRESETS.length);
for (const color of ["#FF3B30", "#2F6BFF", "#FFD400", "#39FF14"]) assert.ok(palettes.INK_COLOR_PRESETS.slice(0, 8).includes(color));
assert.ok(palettes.INK_COLOR_PRESETS.includes("#F72585"));
let chosen, preview, stateIndex = 0;
const hooks = {
  useRef: () => ({ current: null }), useId: () => 'test-swatches', useEffect: () => {}, useLayoutEffect: () => {},
  useState: initial => [stateIndex++ === 0 ? false : 8, () => {}],
};
const exports = {};
vm.runInNewContext(compile("src/features/identity/ColorSwatches.tsx"), { exports, React, require: name => name === 'react' ? hooks : name === 'lucide-react' ? icons : capacity });
const tree = exports.ColorSwatches({ colors: palettes.INK_COLOR_PRESETS, visibleCount: 4, label: 'Ink color', onChoose: color => { chosen = color; }, onPreview: color => { preview = color; } });
const options = tree.props.children[0];
assert.equal(options.props.children.length, 8, 'Measured space takes precedence over the old four-color default');
options.props.children[4].props.onClick();
assert.equal(chosen, palettes.INK_COLOR_PRESETS[4]);
assert.equal(preview, null);
const css = postcss.parse(readFileSync('src/features/identity/design-configurator.css', 'utf8'));
let fixed = false;
css.walkRules('.dc-preview-stock .dc-paper-options button', rule => {
  const values = Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value]));
  if (values.flex?.startsWith('0 0')) {
    assert.equal(values['min-width'], 'var(--dc-swatch-size)');
    assert.equal(values['max-width'], 'var(--dc-swatch-size)');
    assert.equal(values['aspect-ratio'], '1');
    fixed = true;
  }
});
assert.ok(fixed, 'Preset buttons must not shrink into ovals');
const mobile = readFileSync('src/features/identity/design-configurator-mobile.css', 'utf8');
assert.match(mobile, /--dc-auto-swatches: 1/);
console.log('Color swatches: responsive capacity, overflow bounds, expanded inks, selection and fixed circular geometry passed.');
