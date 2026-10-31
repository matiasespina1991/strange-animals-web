import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
const calls=[];
const bytes=Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA','base64');
class Canvas {
  width=1; height=1;
  getContext(){return {translate(){calls.push('flip');},scale(){},drawImage(){}};}
  toBlob(callback,type,quality){calls.push({type,quality});callback(new Blob([bytes],{type}));}
}
class Reader {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
}
globalThis.FileReader=Reader;
globalThis.HTMLCanvasElement=Canvas;
globalThis.document={createElement:()=>new Canvas()};
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('src/features/identity/vinyl-webp-exporter.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{exports,document,Blob,Map,Promise,Error});
const texture=new THREE.CanvasTexture(new Canvas());
texture.userData.vinylWebp=true;
const second=texture.clone();second.repeat.set(2,3);
const group=new THREE.Group();
for(const map of [texture,second]) group.add(new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshStandardMaterial({map,transparent:true})));
const result=await new GLTFExporter().register(exports.vinylWebpPlugin).parseAsync(group,{binary:true});
const buffer=Buffer.from(result);
const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)));
assert.deepEqual(json.extensionsRequired,['EXT_texture_webp']);
assert.ok(json.extensionsUsed.includes('EXT_texture_webp'));
assert.equal(json.images.length,1,'Identical images encoded once');
assert.equal(json.images[0].mimeType,'image/webp');
assert.ok(Number.isInteger(json.images[0].bufferView));
for(const t of json.textures){assert.equal(t.source,undefined);assert.equal(t.extensions.EXT_texture_webp.source,0);}
assert.equal(json.materials[0].alphaMode,'BLEND');
assert.deepEqual(json.materials[1].pbrMetallicRoughness.baseColorTexture.extensions.KHR_texture_transform.scale,[2,3]);
assert.equal(calls.filter(c=>c.type==='image/webp').length,1);
assert.equal(calls.find(c=>c.type==='image/webp').quality,.94);
assert.ok(calls.includes('flip'));
const fallback=texture.clone();delete fallback.userData.vinylWebp;
calls.length=0;
await new GLTFExporter().register(exports.vinylWebpPlugin).parseAsync(new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshStandardMaterial({map:fallback})),{binary:true});
assert.ok(calls.some(call=>call.type==='image/png'));
Canvas.prototype.toBlob=function(callback){callback(new Blob([bytes],{type:'image/png'}));};
await assert.rejects(new GLTFExporter().register(exports.vinylWebpPlugin).parseAsync(group,{binary:true}),/cannot export WebP/);
console.log('WebP: real Three GLB container, extension, shared images, UVs, alpha, orientation, quality and PNG fallback passed (mock canvas).');
