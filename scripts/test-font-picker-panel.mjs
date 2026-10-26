import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as icons from "lucide-react";
import postcss from "postcss";
const compile = file => ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
const layout = {};
vm.runInNewContext(compile("src/features/identity/font-picker-panel-layout.ts"), { exports: layout });
for (const height of [375, 667, 812, 1350]) {
  const normal = layout.fontPickerPanelLayout(height, height, false);
  const expanded = layout.fontPickerPanelLayout(height, height, true);
  assert.ok(normal.canvasHeight > 0 && normal.sheetHeight > 0);
  assert.equal(normal.canvasHeight + normal.sheetHeight, height);
  assert.ok(expanded.sheetHeight >= normal.sheetHeight);
}
assert.equal(layout.fontPickerPanelLayout(400, 812, false).keyboard, true);
assert.equal(layout.fontPickerPanelLayout(400, 812, false).sheetHeight, 288);
let closed = 0, closeFocus = 0, searchFocus = 0, restoredFocus = 0, restoredScroll;
const classes = new Set(), properties = new Map();
const editor = { classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
  style: { getPropertyValue: key => properties.get(key) ?? "", setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) }, dataset: {} };
const viewportListeners = new Map(), documentListeners = new Map();
const fakeWindow = { innerWidth: 390, innerHeight: 812, scrollX: 0, scrollY: 1200,
  matchMedia: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
  addEventListener: () => {}, removeEventListener: () => {}, scrollTo: (...value) => { restoredScroll = value; },
  visualViewport: { height: 812, offsetTop: 0, addEventListener: (name, cb) => viewportListeners.set(name, cb), removeEventListener: name => viewportListeners.delete(name) },
};
const fakeDocument = { body: { style: { overflow: "auto" } }, activeElement: { isConnected: true, focus: () => { restoredFocus++; } },
  addEventListener: (name, cb) => documentListeners.set(name, cb), removeEventListener: name => documentListeners.delete(name) };
const refs = [], effects = [], layouts = [];
const hooks = { useRef: initial => { const ref = { current: initial }; refs.push(ref); return ref; }, useId: () => "font-panel",
  useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useEffect: cb => effects.push(cb), useLayoutEffect: cb => layouts.push(cb) };
const components = {};
vm.runInNewContext(compile("src/features/identity/FontPickerPanel.tsx"), { exports: components, window: fakeWindow, document: fakeDocument, React,
  require: name => name === 'react' ? hooks : name === 'lucide-react' ? icons : name.includes('layout') ? layout : {} });
const tree = components.FontPickerPanel({ children: React.createElement('p', null, 'Catalog'), close: () => { closed++; }, targetName: 'Release title' });
assert.equal(tree.props.className.includes('dc-font-picker-panel'), true);
refs[0].current = { closest: () => editor };
refs[1].current = { querySelector: () => ({ focus: () => { searchFocus++; } }) };
refs[2].current = { focus: () => { closeFocus++; } };
const layoutCleanup = layouts.map(cb => cb());
const effectCleanup = effects.map(cb => cb());
assert.ok(classes.has('dc-font-picker-mobile-open'));
assert.equal(fakeDocument.body.style.overflow, 'hidden');
assert.equal(properties.get('--dc-font-sheet-height'), '455px');
assert.equal(closeFocus, 1);
assert.equal(searchFocus, 0, 'Mobile opening must not summon the keyboard');
fakeWindow.visualViewport.height = 400;
fakeWindow.innerHeight = 400;
viewportListeners.get('resize')();
assert.equal(properties.get('--dc-font-sheet-height'), '288px', 'Android keyboard resize must preserve list space');
assert.equal(editor.dataset.fontKeyboard, 'true');
documentListeners.get('keydown')({ key: 'Escape', preventDefault: () => {} });
assert.equal(closed, 1);
for (const cleanup of [...layoutCleanup, ...effectCleanup]) cleanup?.();
assert.equal(classes.size, 0);
assert.equal(properties.size, 0);
assert.equal(fakeDocument.body.style.overflow, 'auto');
assert.deepEqual(restoredScroll, [0, 1200]);
assert.equal(restoredFocus, 1);
const source = readFileSync('src/features/identity/DesignConfiguratorEditor.tsx', 'utf8');
assert.match(source, /if \(!isMobileFontPicker\(\)\) setDialog\(null\)/);
assert.equal((source.match(/<FontPickerPanel\b/g) ?? []).length, 1);
const css = postcss.parse(readFileSync('src/features/identity/font-picker-panel.css', 'utf8'));
assert.ok(css.nodes.length);
assert.match(css.toString(), /prefers-reduced-motion/);
console.log('Font panel: split layout, keyboard/landscape sizing, no auto keyboard, Escape, scroll/focus restoration and shared catalog passed.');
