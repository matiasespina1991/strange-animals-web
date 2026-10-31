import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('src/features/identity/vinyl-model-export.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{exports,require:()=>THREE});
const preview=new THREE.Group();
preview.add(new THREE.Mesh(new THREE.BoxGeometry(3.15,3.15,.03),new THREE.MeshStandardMaterial()));
const exported=exports.prepareVinylModelExport(preview);
const size=new THREE.Box3().setFromObject(exported).getSize(new THREE.Vector3());
assert.ok(Math.abs(size.x-.315)<1e-6,'315 mm sleeve exports at real vinyl size');
assert.equal(preview.scale.x,1,'Export does not resize the live preview');
assert.equal(exported.userData.vinylArtworkScale,.1);
assert.equal(exports.prepareVinylModelExport(preview).scale.x,.1,'Repeated exports do not accumulate scale');
console.log('Vinyl export: physical scale is embedded, 315 mm sleeve, unchanged preview and stable repeated exports passed.');

function canvas(pixels) {
  return {width: pixels.length / 4, height: 1,
    getContext: () => ({getImageData: () => ({data: new Uint8ClampedArray(pixels)})})};
}
const options = {deduplicateTextures:true, solidColors:true, jpegArtwork:true, requiredMapsOnly:true};
const scene = new THREE.Group();
function face(pixels) {
  const texture = new THREE.CanvasTexture(canvas(pixels));
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshPhysicalMaterial({map:texture});
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(),material));
  return material;
}
const solid = face([128,128,128,255,128,128,128,255]);
const photo = face([20,30,40,255,100,110,120,255]);
const duplicate = face([20,30,40,255,100,110,120,255]);
duplicate.map.repeat.set(2,3);
const transparent = face([20,30,40,120,100,110,120,255]);
photo.clearcoatMap = new THREE.CanvasTexture(canvas([255,255,255,255]));
const result = exports.prepareVinylModelExport(scene,options);
assert.equal(result.children[0].material.map,null);
assert.ok(Math.abs(result.children[0].material.color.r - new THREE.Color('#808080').r)<1e-6);
assert.equal(result.children[1].material.map.userData.mimeType,'image/jpeg');
assert.equal(result.children[1].material.map.image,result.children[2].material.map.image);
assert.equal(result.children[2].material.map.repeat.y,3);
assert.equal(result.children[3].material.map.userData.mimeType,undefined);
assert.equal(result.children[1].material.clearcoatMap,null);
assert.ok(solid.map && photo.clearcoatMap);
assert.equal(photo.map.userData.mimeType,undefined);
const baseline = exports.prepareVinylModelExport(scene,Object.fromEntries(Object.keys(options).map(key=>[key,false])));
assert.ok(baseline.children[0].material.map);
assert.equal(baseline.children[1].material.map.userData.mimeType,undefined);
console.log('GLB experiments 2/3/4/7: exact deduplication, transforms, solid linear color, opaque-only JPEG, unused maps and unchanged preview/baseline passed.');
