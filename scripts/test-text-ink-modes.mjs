import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const model = {};
vm.runInNewContext(ts.transpileModule(
  readFileSync('src/features/identity/design-configurator-model.ts', 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}},
).outputText, {exports: model, crypto: globalThis.crypto});
const layer = {...model.initialDesign.A[0],
  textTexture: 'data:image/png;base64,aGVsbG8=', blendMode: 'difference'};
assert.equal(model.textInkMode(layer), 'surface');
assert.equal(model.textInkMode({...layer, textTexture: undefined}), 'contrast');
assert.equal(model.textInkMode({...layer, textTexture: undefined, blendMode: undefined}), 'color');
for (const inkMode of ['color', 'contrast', 'surface']) {
  const stored = {...layer, inkMode};
  const rendered = model.effectiveTextInk(stored);
  assert.equal(rendered.textTexture, inkMode === 'surface' ? layer.textTexture : undefined);
  assert.equal(rendered.blendMode, inkMode === 'contrast' ? 'difference' : 'normal');
  assert.equal(stored.textTexture, layer.textTexture, 'Inactive texture is retained');
  const design = structuredClone(model.initialDesign);
  design.A[0] = stored;
  const parsed = model.parseDesign(JSON.parse(JSON.stringify(design)));
  assert.equal(parsed.A[0].inkMode, inkMode);
  assert.equal(parsed.A[0].textTexture, layer.textTexture);
}
const image = {...layer, kind: 'image'};
assert.equal(model.effectiveTextInk(image), image);
const source = readFileSync('src/features/identity/DesignConfiguratorEditor.tsx', 'utf8');
assert.ok(source.includes('role="tablist" aria-label="Ink appearance"'));
assert.ok(source.includes('aria-selected={selectedTextLayers.every'));
assert.ok(source.includes('event.key === "ArrowLeft"'));
assert.ok(!source.includes('Ink Matte'));
assert.ok(!source.includes('<TextBlendModeControl'));
assert.ok(readFileSync('src/features/identity/LabelArtwork.tsx', 'utf8').includes('.map(effectiveTextInk)'));
console.log('Ink modes: mutually exclusive rendering, retained settings, import, legacy defaults and accessible tabs passed.');
