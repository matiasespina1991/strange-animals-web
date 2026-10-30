import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
let fail=false;
const requested=[], canvases=[];
class Image {
  naturalWidth=2048;
  naturalHeight=1201;
  set src(value) {requested.push(value);queueMicrotask(()=>fail?this.onerror():this.onload());}
}
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('src/features/identity/sleeve-pbr-paper.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{exports,require:()=>THREE,Image,document:{createElement:()=>{
  const canvas={draws:[], pixels:null};canvases.push(canvas);
  canvas.getContext=()=>({drawImage:(...args)=>canvas.draws.push(args),
    getImageData:()=>({data:new Uint8ClampedArray(2048*2048*4).fill(128)}),
    putImageData:image=>{canvas.pixels=image.data;}});
  return canvas;
}}});
const [normal,roughness]=await exports.loadClassicSleevePaper();
assert.ok(requested[0].endsWith('NormalGL.jpg'),'Uses OpenGL rather than DirectX normals');
assert.ok(requested[1].endsWith('Roughness.jpg'));
assert.equal(requested.length,2,'No downloaded color map changes artwork');
for(const map of [normal,roughness]) {
  assert.ok(map.isCanvasTexture,'Export uses the transform-aware canvas path');
  assert.equal(map.colorSpace,THREE.NoColorSpace);
  assert.equal(map.flipY,true);
  assert.equal(map.image.width,2048);
  assert.equal(map.image.height,2048);
  assert.equal(map.image.draws.length,66);
  const [,x,y,w,h]=map.image.draws[0];
  assert.equal(x,0);assert.equal(y,0);assert.equal(w/h,2048/1201,'Preserves rectangular source proportions');
}
assert.equal(roughness.image.pixels[1],238,'Restrained roughness retains the satin appearance');
normal.dispose();roughness.dispose();
fail=true;
await assert.rejects(exports.loadClassicSleevePaper(),/could not be loaded/);
console.log('Sleeve classic paper: 2K normal/roughness only, correct proportions, linear maps, restrained satin response, exportable canvases and load failure passed.');
