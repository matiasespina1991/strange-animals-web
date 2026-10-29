import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
const source = readFileSync('src/features/identity/design-configurator-model.ts', 'utf8');
const json = Object.create(JSON);
json.stringify = () => { throw Error('History must never serialize embedded assets'); };
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, JSON: json });
const { initialDesign, designReducer } = exports;
const asset = 'data:image/png;base64,' + 'A'.repeat(4 * 1024 * 1024);
const document = { ...initialDesign, sleeveA: [{ ...initialDesign.A[0], kind: 'image', image: asset }] };
const initial = { past: [], present: document, future: [] };
const changeX = (state, x, group) => designReducer(state, {
  type: 'change', group,
  change: current => ({ ...current, A: current.A.map((layer, i) => i ? layer : { ...layer, x }) }),
});
assert.equal(designReducer(initial, { type: 'change', change: current => current }), initial);
assert.equal(designReducer(initial, { type: 'change', change: current => ({ ...current }) }), initial);
assert.equal(designReducer(initial, { type: 'change', change: current => ({ ...current, A: current.A.map(layer => ({ ...layer, finishDepth: undefined })) }) }), initial);
assert.equal(designReducer(initial, { type: 'end' }), initial);
let state = changeX(initial, 42, 'drag');
assert.equal(state.past.length, 1);
assert.equal(state.present.sleeveA, document.sleeveA, 'Unchanged image branch remains shared');
state = changeX(state, 43, 'drag');
assert.equal(state.past.length, 1, 'A drag is still one undo step');
assert.equal(changeX(state, 43, 'drag'), state, 'Equal nested copies are a no-op');
state = designReducer(state, { type: 'end' });
state = designReducer(state, { type: 'undo' });
assert.equal(state.present, document);
assert.equal(state.future.length, 1);
assert.equal(designReducer(state, { type: 'change', change: current => ({ ...current }) }), state, 'No-op preserves redo');
state = designReducer(state, { type: 'redo' });
assert.equal(state.present.A[0].x, 43);
state = designReducer(state, { type: 'undo' });
state = changeX(state, 44);
assert.equal(state.future.length, 0, 'New edits discard redo');
const withFinish = designReducer(state, { type: 'change', change: current => ({...current, A: current.A.map((layer,i) => i ? layer : {...layer,finish:'emboss',finishDepth:.4})}) });
assert.equal(withFinish.present.A[0].finishDepth,.4);
const reordered = designReducer(withFinish, { type: 'change', change: current => ({...current,A:[...current.A].reverse()}) });
assert.notEqual(reordered,withFinish,'Layer order changes are not lost');
const removed = designReducer(withFinish, { type:'change', change:current=>({...current,A:[]}) });
assert.equal(removed.present.A.length,0);
const windowChange = designReducer(state, {type:'change',change:current=>({...current,sleeveWindowA:false})});
assert.equal(windowChange.present.sleeveWindowA,false);
for(let i=0;i<110;i++) state=changeX(state,100+i);
assert.equal(state.past.length,100,'Existing history limit is unchanged');
assert.equal(state.present.sleeveA[0].image,asset);
console.log('History: no JSON serialization with 4 MiB asset, identity/nested no-ops, optional fields, grouped undo/redo, order and 100-step limit passed.');
