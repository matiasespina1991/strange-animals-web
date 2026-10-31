import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('src/features/ar-model/ARModelPage.tsx','utf8');
const start=source.indexOf('        let loaded = false;');
const end=source.indexOf('        const arButton',start);
assert.ok(start>0&&end>start);
function harness(){
  const handlers={};let progress=0,error='';
  const context={active:true,viewer:{addEventListener:(name,fn)=>handlers[name]=fn},
    setModelLoadProgress:value=>progress=typeof value==='function'?value(progress):value,
    setViewerError:value=>error=value};
  vm.runInNewContext(ts.transpileModule(source.slice(start,end),{
    compilerOptions:{target:ts.ScriptTarget.ES2022},
  }).outputText,context);
  return {handlers,context,get progress(){return progress;},get error(){return error;}};
}
const h=harness();
const update=(value,reason='model-load')=>h.handlers.progress({detail:{totalProgress:value,reason}});
update(.42);assert.equal(h.progress,42);
update(.1);assert.equal(h.progress,42);
update(.9,'usdz-conversion');assert.equal(h.progress,42);
update(NaN);assert.equal(h.progress,42);
update(1);assert.equal(h.progress,99);
h.handlers.load();assert.equal(h.progress,null);
update(.5);assert.equal(h.progress,null);
const failed=harness();failed.handlers.error();assert.equal(failed.progress,null);assert.ok(failed.error);
const stale=harness();stale.context.active=false;stale.handlers.progress({detail:{totalProgress:.6}});assert.equal(stale.progress,0);
assert.match(source,/aria-valuenow=\{modelLoadProgress\}/);
assert.match(source,/setModelLoadProgress\(0\)/);
console.log('GLB progress: actual events, monotonic percent, first-frame completion, ignored AR conversion, error and stale callbacks passed.');
