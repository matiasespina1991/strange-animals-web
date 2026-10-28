import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/features/identity/DesignConfiguratorEditor.tsx', 'utf8');
const ast = ts.createSourceFile('editor.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = {};
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['selectFont', 'previewFamilyFor'].includes(node.name.getText(ast)))
    functions[node.name.getText(ast)] = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
let state, changes, commits, closed;
const context = {
  resolveLabelFont: async () => ({ family: 'New Family', variant: { id: 'new-variant' } }),
  setFamilies: () => {}, fontKey: () => 'key', setFontBusy: () => {},
  hoverRequest: { current: 0 }, setHoverFamily: () => {}, setHoverFontLoading: () => {},
  isMobileFontPicker: () => false, setDialog: value => { closed = value; },
  setNotice: error => { throw Error(error); },
  change: update => { state = update(state); changes++; }, end: () => { commits++; },
  updateSurfaceLayers: (design, surface, side, update) => {
    const group = surface === 'cookie' ? side : `sleeve${side}`;
    return { ...design, [group]: update(design[group]) };
  },
  familyFor: layer => layer.fontId,
};
vm.createContext(context);
vm.runInContext(ts.transpileModule(Object.entries(functions).map(([name, fn]) => `globalThis.${name} = ${fn};`).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText, context);
for (const surface of ['cookie', 'sleeve']) for (const side of ['A', 'B']) {
  const group = surface === 'cookie' ? side : `sleeve${side}`;
  const layers = [
    { id: 'one', kind: 'text', fontId: 'Original One' },
    { id: 'two', kind: 'circular', fontId: 'Original Two' },
    { id: 'image', kind: 'image', fontId: 'Image metadata' },
    { id: 'other', kind: 'text', fontId: 'Unselected' },
  ];
  state = { A: [], B: [], sleeveA: [], sleeveB: [], [group]: layers };
  Object.assign(context, { side, surface, selectedTextLayers: layers.slice(0, 2),
    selection: new Set(['one', 'two', 'image']), dialog: 'fonts', hoverFamily: 'Preview Family' });
  for (const layer of layers.slice(0, 2)) assert.equal(context.previewFamilyFor(layer, surface), 'Preview Family');
  assert.equal(context.previewFamilyFor(layers[2], surface), 'Image metadata');
  assert.equal(context.previewFamilyFor(layers[3], surface), 'Unselected');
  assert.equal(context.previewFamilyFor(layers[0], surface === 'cookie' ? 'sleeve' : 'cookie'), 'Original One');
  context.hoverFamily = null;
  assert.equal(context.previewFamilyFor(layers[0], surface), 'Original One', 'Hover exit restores committed font');
  changes = commits = 0;
  await context.selectFont({ id: 'new-font' });
  assert.equal(state[group][0].fontId, 'new-font');
  assert.equal(state[group][1].variantId, 'new-variant');
  assert.equal(state[group][2].fontId, 'Image metadata');
  assert.equal(state[group][3].fontId, 'Unselected');
  assert.equal(layers[0].fontId, 'Original One', 'Do not mutate history snapshots');
  assert.equal(changes, 1, 'Apply all selected fonts in one undoable change');
  assert.equal(commits, 2);
  assert.equal(closed, null);
}
console.log('Multi-font selection: simultaneous preview/commit, restoration, image exclusion, both surfaces/sides and one undo step passed.');
