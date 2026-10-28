import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/features/identity/DesignConfiguratorEditor.tsx', 'utf8');
const ast = ts.createSourceFile('editor.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let copy, contextMenu;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'copyLayersToOtherSide') copy = node.initializer.getText(ast);
  if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'onContextMenu') contextMenu = node.initializer.expression.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(copy && contextMenu);
let current, selected, selectedLayers, notice, changes, ends;
const context = {
  structuredClone,
  crypto: { randomUUID: () => `copy-${Math.random()}` },
  Element: class {},
  getSurfaceLayers: (design, surface, side) => design[surface === 'sleeve' ? `sleeve${side}` : side],
  updateSurfaceLayers: (design, surface, side, update) => {
    const key = surface === 'sleeve' ? `sleeve${side}` : side;
    return { ...design, [key]: update(design[key]) };
  },
  setLayerContextMenu: value => { context.layerContextMenu = value; },
  setSelected: value => { selected = value; },
  setSelectedLayers: value => { selectedLayers = value; },
  setNotice: value => { notice = value; },
  change: update => { current = update(current); changes++; },
  end: () => { ends++; },
};
vm.createContext(context);
const transpile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInContext(transpile(`globalThis.copy = ${copy}; globalThis.openMenu = ${contextMenu};`), context);
for (const surface of ['cookie', 'sleeve']) for (const side of ['A', 'B']) {
  const origin = surface === 'sleeve' ? `sleeve${side}` : side;
  const target = surface === 'sleeve' ? `sleeve${side === 'A' ? 'B' : 'A'}` : side === 'A' ? 'B' : 'A';
  current = { A: [], B: [], sleeveA: [], sleeveB: [] };
  current[origin] = [
    { id: 'one', x: 12, textEffect: { type: 'cylinder', closed: true } },
    { id: 'two', kind: 'image', image: 'data:example', imageCrop: { top: 5 } },
  ];
  context.design = current;
  context.layers = current[origin];
  context.selection = new Set(['one', 'two']);
  context.side = side;
  context.surface = surface;
  const element = new context.Element();
  element.closest = selector => selector.includes('input') ? null : { dataset: { layerId: 'one' } };
  let prevented = false;
  context.openMenu({ target: element, clientX: 30, clientY: 40, preventDefault: () => { prevented = true; } });
  assert.ok(prevented);
  assert.equal(context.layerContextMenu.ids.length, 2, 'Keep existing multiselection on right click');
  changes = ends = 0;
  context.copy();
  assert.equal(current[target].length, 2);
  assert.equal(current[origin].length, 2, 'Copy does not move layers');
  assert.notEqual(current[target][0].id, 'one');
  assert.notEqual(current[target][0].textEffect, current[origin][0].textEffect, 'Deep copy effects');
  assert.equal(current[target][1].imageCrop.top, 5);
  assert.equal(changes, 1, 'One undoable operation');
  assert.equal(ends, 2);
  context.selection = new Set(['two']);
  context.openMenu({ target: element, clientX: 0, clientY: 0, preventDefault() {} });
  assert.equal(context.layerContextMenu.ids.length, 1, 'Right click outside selection targets only that layer');
  assert.equal(selected, 'one');
  assert.equal(selectedLayers.length, 1);
  current[target] = Array.from({ length: 50 }, () => ({ id: 'existing' }));
  context.design = current;
  changes = 0;
  context.copy();
  assert.equal(changes, 0, 'Capacity limit never partially copies a selection');
  assert.match(notice, /limit of 50/);
}
console.log('Layer context menu: selection, both surfaces/directions, deep copies, source preservation, undo boundary and capacity checks passed.');
