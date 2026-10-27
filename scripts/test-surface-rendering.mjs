import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (!name.startsWith('.')) return require(name);
    const base = resolve(dirname(file), name);
    return load(['.tsx', '.ts'].map(ext => base + ext).find(existsSync));
  } });
  return module.exports;
}
const { LabelArtwork } = load(resolve('src/features/identity/LabelArtwork.tsx'));
const layer = { id: 'sample', name: 'Sample', kind: 'text', visible: true,
  text: 'One\nTwo', x: 300, y: 300, size: 30, spacing: 4,
  lineHeight: 1.6, blur: 2, inkBleed: 1.5, opacity: 0.6, angle: 0,
  align: 'middle', color: '#aabbcc' };
const design = { title: 'Test', diameterMm: 100, holeMm: 7.3, safeMm: 3,
  paper: '#ffffff', A: [layer], B: [], sleeveA: [layer], sleeveB: [] };
const render = (surface, value = layer) => renderToStaticMarkup(React.createElement(LabelArtwork, {
  design: { ...design, A: [value], sleeveA: [value] }, side: 'A', surface,
  prefix: 'test', fontFamily: () => 'Test Font',
}));
for (const value of [layer, { ...layer, kind: 'circular', radius: 150 }]) {
  const cookie = render('cookie', value), sleeve = render('sleeve', value);
  const appearance = markup => markup.slice(markup.indexOf('<g data-layer-id='), markup.lastIndexOf('</g>'));
  assert.equal(appearance(cookie), appearance(sleeve), 'Both surfaces must produce identical layer markup');
  assert.match(sleeve, /letter-spacing="4"/);
  assert.match(sleeve, /blur\(2px\)/);
  assert.match(sleeve, /test-ink-bleed-0/);
  assert.match(sleeve, /opacity="0.6"/);
  assert.match(sleeve, /<rect width="600" height="600"/);
  assert.doesNotMatch(sleeve, /fill="#ffffff"/);
}
assert.match(render('sleeve'), /dy="1.6em"/);
const exporter = readFileSync('src/features/identity/design-configurator-export.tsx', 'utf8');
assert.match(exporter, /<LabelArtwork[\s\S]*?surface="sleeve"/);
console.log('Sleeve/Cookie: identical text and arc rendering, spacing, line height, blur, ink bleed, opacity and shared export passed.');
