import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync('src/features/identity/font-load-diagnostics.ts', 'utf8');
function setup(dev) {
  const calls = [], timers = new Map(), window = {};
  let timerId = 0;
  const exports = {};
  const code = ts.transpileModule(source.replace('import.meta.env.DEV', String(dev)), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    exports, window,
    console: Object.fromEntries(['info', 'warn', 'error'].map(level => [level, (...args) => calls.push({ level, args })])),
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
  });
  return { exports, calls, timers, window };
}
const dev = setup(true);
const trace = dev.exports.traceFontLoad({ fontId: 'flak', variantId: 'regular' });
trace.event('queued');
assert.equal(dev.window.__fontLoadDiagnostics()[0].stage, 'queued');
trace.event('download:body', { loadedBytes: 1 });
const bodyTimer = [...dev.timers.keys()][0];
trace.event('download:body', { loadedBytes: 2 });
assert.equal([...dev.timers.keys()][0], bodyTimer, 'Progress must not hide a stalled stage');
dev.timers.get(bodyTimer)();
assert.ok(dev.calls.some(call => call.level === 'warn' && call.args[1].stage === 'download:body'));
trace.finish('ready');
assert.equal(dev.timers.size, 0);
assert.equal(dev.window.__fontLoadDiagnostics().length, 0);
const failed = dev.exports.traceFontLoad({ fontId: 'broken' });
failed.event('decode:fontface');
failed.finish('failed', new Error('Decode failed'));
assert.ok(dev.calls.some(call => call.level === 'error' && call.args[1].stage === 'decode:fontface'));
const cancelled = dev.exports.traceFontLoad({ fontId: 'cancelled' });
cancelled.event('queued');
cancelled.finish('cancelled');
assert.equal(dev.timers.size, 0);
const prod = setup(false);
const silent = prod.exports.traceFontLoad({ fontId: 'flak' });
silent.event('queued'); silent.finish('failed', new Error('Hidden'));
prod.exports.logFontLoad('queue:started', { key: 'flak' });
assert.equal(prod.calls.length, 0);
assert.equal(prod.timers.size, 0);
assert.equal(prod.window.__fontLoadDiagnostics, undefined);
console.log('Font diagnostics: stages, live snapshot, slow-stage warning, cleanup, errors and production silence passed.');
