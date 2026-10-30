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
