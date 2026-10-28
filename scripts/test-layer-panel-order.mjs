import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/features/identity/DesignConfiguratorEditor.tsx', 'utf8');
const ast = ts.createSourceFile('editor.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let expression, reorder;
function visit(node) {
  if (ts.isVariableDeclaration(node)) {
    if (node.name.getText(ast) === 'panelLayers') expression = node.initializer.getText(ast);
    if (node.name.getText(ast) === 'moveLayer') reorder = node.initializer.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
const layers = [{ id: 'back' }, { id: 'middle' }, { id: 'front' }];
let state = { A: layers };
const context = { layers, surface: 'cookie', side: 'A',
  getSurfaceLayers: design => design.A,
  updateSurfaceLayers: (design, surface, side, update) => ({ ...design, A: update(design.A) }),
  change: update => { state = update(state); },
};
vm.createContext(context);
vm.runInContext(ts.transpileModule(`globalThis.panel = ${expression}; globalThis.move = ${reorder};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText, context);
assert.equal(context.panel.map(layer => layer.id).join(','), 'front,middle,back');
assert.equal(layers.map(layer => layer.id).join(','), 'back,middle,front', 'Panel must not mutate stacking order');
context.move('back', 'front', false); // Visual drop above = after in render order.
assert.equal(state.A.map(layer => layer.id).join(','), 'middle,front,back');
assert.match(source, /moveLayer\(sourceId, layer.id, !before\)/);
assert.match(source, /const anchor = panelLayers.findIndex/);
assert.match(source, /const range = panelLayers/);
console.log('Layer panel: reversed display without changing artwork, matching drag direction and range selection passed.');
