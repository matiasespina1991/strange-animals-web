import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('src/features/identity/canvas-zoom.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{exports});
const {zoomCanvasAt}=exports;
function assertAnchor(view,requested,anchor) {
  const next=zoomCanvasAt(view,requested,anchor);
  for(const axis of ['x','y']) {
    const before=(anchor[axis]-view.viewOffset[axis])/(view.zoom/100);
    const after=(anchor[axis]-next.viewOffset[axis])/(next.zoom/100);
    assert.ok(Math.abs(before-after)<1e-8,'Artwork point stays under cursor/centre');
  }
  return next;
}
for(const offset of [{x:0,y:0},{x:180,y:-94},{x:-280,y:350}]) {
  for(const anchor of [{x:0,y:0},{x:240,y:-160},{x:-300,y:180}]) {
    let view={zoom:100,viewOffset:offset};
    for(const requested of [130,200,1200,1600,60,15,100]) view=assertAnchor(view,requested,anchor);
    assert.equal(view.zoom,100);
    assert.ok(Math.abs(view.viewOffset.x-offset.x)<1e-8);
    assert.ok(Math.abs(view.viewOffset.y-offset.y)<1e-8);
  }
}
const limit={zoom:1200,viewOffset:{x:200,y:100}};
assert.equal(zoomCanvasAt(limit,1400,{x:340,y:0}),limit,'At limit the view does not drift');
const source=readFileSync('src/features/identity/DesignConfiguratorEditor.tsx','utf8');
assert.match(source,/zoomWorkspace\(touchView.current.zoom \* Math.exp/);
assert.match(source,/x: event.clientX, y: event.clientY/);
assert.match(source,/onPointerLeave=\{\(\) => \{ canvasPointer.current = null;/);
assert.match(source,/zoomWorkspace\(touchView.current.zoom - 30\)/);
assert.match(source,/zoomWorkspace\(touchView.current.zoom \+ 30\)/);
console.log('Canvas zoom: pointer/centre anchor, panned views, reverse zoom, bounds without drift and wheel/button wiring passed.');
