import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = readFileSync("src/features/identity/DesignConfiguratorEditor.tsx", "utf8");
const ast = ts.createSourceFile("editor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let fn;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "importImage") fn = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
let layers = Array.from({ length: 49 }, (_, id) => ({ id }));
const updates = [], images = [];
let selected = 0;
const context = {
  documentEpoch: { current: 0 }, layers, side: "A", surface: "cookie",
  FileReader: class { readAsDataURL() { this.result = "data:image/png;base64,test"; this.onload(); } },
  Image: class { naturalWidth = 100; naturalHeight = 100; set src(value) { images.push(this); } },
  makeLayer: () => ({ id: String(Math.random()), kind: "image" }), clamp: (v, min, max) => Math.min(max, Math.max(min, v)),
  initialImageLayerPosition: () => ({ x: 0, y: 0 }),
  change: update => updates.push(update), selectLayer: () => { selected++; }, setNotice: () => {},
  updateSurfaceLayers: (design, surface, side, update) => ({ ...design, [side]: update(design[side]) }),
};
vm.createContext(context);
vm.runInContext(ts.transpileModule(`globalThis.importImage=${fn}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const file = { name: "test.png", type: "image/png", size: 100 };
const first = context.importImage(file), second = context.importImage(file);
await Promise.resolve();
images.splice(0).forEach(image => image.onload());
await Promise.all([first, second]);
let design = { A: layers };
for (const update of updates.splice(0)) design = update(design);
assert.equal(design.A.length, 50, "Concurrent completions from 49 layers must not insert 51");
const stale = context.importImage(file);
await Promise.resolve();
context.documentEpoch.current++;
const selectionsBefore = selected;
images.splice(0).forEach(image => image.onload());
await stale;
assert.equal(updates.length, 0, "Stale image must not dispatch a document change");
assert.equal(selected, selectionsBefore, "Stale image must not change selection");
console.log("Async images: stale document completion discarded and concurrent capacity enforced in commit passed.");
