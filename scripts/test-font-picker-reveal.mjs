import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync('src/features/identity/DesignConfiguratorEditor.tsx', 'utf8');
const ast = ts.createSourceFile('editor.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useLayoutEffect' && node.arguments[0]?.getText(ast).includes('const index = sortedFonts.findIndex')) callback = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(callback);
const events = new Map();
let rowY = 100, resize, disconnected = false;
const list = { scrollTop: 900, clientTop: 0, getBoundingClientRect: () => ({ top: 0 }),
  querySelectorAll: () => [{ dataset: { fontFamily: 'selected' }, getBoundingClientRect: () => ({ top: rowY - list.scrollTop }) }],
  addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name),
};
const context = { dialog: 'fonts', query: '', deferredQuery: '', pendingFontReveal: { current: 'selected' },
  sortedFonts: Array.from({ length: 100 }, (_, i) => ({ id: i === 90 ? 'selected' : `font-${i}` })),
  fontLimit: 40, fontScrollKey: 'all', fontsLoading: false, fontResults: { current: list },
  fontViewLimits: { current: new Map() }, fontScrollPositions: { current: new Map() },
  setFontLimit: limit => { context.fontLimit = limit; },
  requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame() {},
  ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} disconnect() { disconnected = true; } },
};
vm.createContext(context);
vm.runInContext(ts.transpileModule(`globalThis.reveal = ${callback}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
context.reveal();
assert.equal(context.fontLimit, 120, 'Reveal selected font beyond first results page');
assert.equal(context.pendingFontReveal.current, 'selected');
const cleanup = context.reveal();
assert.equal(list.scrollTop, 92, 'Align selected family at top, not previous pixel offset');
rowY = 180;
resize();
assert.equal(list.scrollTop, 172, 'Keep selection visible after preview heights change');
events.get('wheel')();
assert.ok(disconnected);
rowY = 300;
resize();
assert.equal(list.scrollTop, 172, 'Never fight user scrolling');
cleanup();
assert.equal(events.size, 0);
console.log('Font picker reopen: selected family pagination, identity-based alignment, async size correction, user-scroll cancellation and cleanup passed.');
