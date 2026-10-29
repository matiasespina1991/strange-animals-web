import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as icons from 'lucide-react';
import * as jsx from 'react/jsx-runtime';
import postcss from 'postcss';

const stamp = { toDate: () => new Date('2026-10-27'), toMillis: () => 1 };
const project = { id: 'project-1', title: 'Test artwork', latestVersion: 2, latestVersionId: 'v2', updatedAt: stamp };
const source = readFileSync('src/features/identity/MyGalleryPage.tsx', 'utf8');
function render(selected) {
  let index = 0;
  const state = [[project], [], [], {}, selected, [{ id: 'v1', version: 1, createdAt: stamp }], {}, 'designs', false, false, null, ''];
  const hooks = { useState: () => [state[index++], () => {}], useEffect: () => {}, useRef: value => ({ current: value }) };
  const exports = {};
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return jsx;
    if (name === 'lucide-react') return icons;
    if (name.endsWith('account-auth')) return { accountAuth: { currentUser: { uid: 'owner' } } };
    if (name.endsWith('AccountControl')) return { AccountControl: () => null };
    return {};
  } });
  return renderToStaticMarkup(React.createElement(exports.MyGalleryPage, { onBack() {}, onEditVersion() {} }));
}
const overview = render(null);
assert.match(overview, /Your design projects/);
assert.doesNotMatch(overview, /Choose a version/);
const detail = render('project-1');
assert.match(detail, /Choose a version/);
assert.match(detail, /MY GALLERY/);
assert.match(detail, /Delete project/);
assert.match(detail, /Double-click to rename project/);
assert.doesNotMatch(detail, /<span>Versions<\/span>/);
assert.match(detail, /Edit version 1/);
assert.doesNotMatch(detail, /Your design projects/);
assert.doesNotMatch(source, /nextProjects\[0\]/);
assert.match(source, /b\.version - a\.version/);
assert.match(source, /a\.createdAt \?\? a\.updatedAt/);
const css = readFileSync('src/features/identity/my-gallery.css', 'utf8');
const stylesheet = postcss.parse(css);
stylesheet.walkRules(rule => {
  rule.walkDecls('animation', declaration => {
    if (/mg-face-[ab]/.test(declaration.value) && !rule.selector.startsWith('@')) {
      assert.match(rule.selector, /:hover/, 'Face changes must only run during hover');
      assert.match(declaration.value, /4s ease-in-out/, 'Smooth crossfade every two seconds, four seconds per full cycle');
    }
  });
});
assert.match(css, /\.mg-model-grid\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
assert.match(css, /43\.75%/, 'Hold each face before the 250ms crossfade');
console.log('Gallery: distinct overview/history screens, version editing, no automatic selection, chronological sorting and CSS passed.');
