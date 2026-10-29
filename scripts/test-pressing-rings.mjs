import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/features/identity/pressing-rings.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, require: () => THREE });
const { PRESSING_PRESETS, pressingHeight, applyPressingRelief } = exports;
assert.equal(PRESSING_PRESETS.length, 6);
const geometry = new THREE.RingGeometry(0.0365, 0.494, 256, 192);
const base = new Float32Array(geometry.getAttribute('position').array);
const uv = new Float32Array(geometry.getAttribute('uv').array);
const signatures = new Set();
for (const { id } of PRESSING_PRESETS) {
  const profile = Array.from({ length: 1000 }, (_, i) => pressingHeight(i / 2000, 0.5, id));
  assert.ok(profile.every(value => Number.isFinite(value) && Math.abs(value) < 0.0025));
  signatures.add(JSON.stringify(profile));
  if(id !== 'raised-hub') assert.equal(pressingHeight(0.0365, 0.5, id), 0, 'Existing profiles preserve the spindle rim');
  assert.equal(pressingHeight(0.494, 0.5, id), 0, 'No outer-edge seam');
  applyPressingRelief(geometry, 0.5, id, 1);
  assert.equal(Object.keys(geometry.userData).length, 0, 'No restoration buffers serialized as GLB extras');
  assert.deepEqual(geometry.getAttribute('uv').array, uv, 'Artwork UVs stay continuous');
  assert.ok([...geometry.getAttribute('normal').array].every(Number.isFinite));
  const once = new Float32Array(geometry.getAttribute('position').array);
  applyPressingRelief(geometry, 0.5, id, 1);
  assert.deepEqual(geometry.getAttribute('position').array, once, 'Repeated selection must not accumulate displacement');
}
assert.equal(signatures.size, 6, 'Distinct radial profiles');
const hub=pressingHeight(.05,.5,'raised-hub');
assert.ok(hub>0);
assert.ok(Math.abs(hub-.00165*.7)<1e-12,'Central elevation reduced 30%');
assert.equal(pressingHeight(.0365,.5,'raised-hub'),hub,'Centre plateau extends to bore, without another inner groove');
assert.equal(pressingHeight(.12*.765,.5,'raised-hub'),hub,'Whole central disc is elevated');
assert.equal(pressingHeight(.15*.765,.5,'raised-hub'),hub,'Plateau extends farther before the steeper shoulder');
assert.ok(pressingHeight(.15625*.765,.5,'raised-hub')>0 && pressingHeight(.15625*.765,.5,'raised-hub')<hub,'Shorter, more pronounced shoulder');
assert.equal(pressingHeight(.16*.765,.5,'raised-hub'),0,'Surrounding label remains flat, no extra outer ring');
for(let r=0;r<.5;r+=.001) assert.ok(pressingHeight(r,.5,'raised-hub')>=0,'No engraved line around the plateau');
assert.ok(Math.abs(pressingHeight(0.135, 0.5, 'small') + 0.00195) < 1e-9, 'Ring depth increased to three times the original');
applyPressingRelief(geometry, 0.5, 'flat', 1);
assert.deepEqual(geometry.getAttribute('position').array, base, 'Flat restores exact original surface');
const back = geometry.clone();
applyPressingRelief(geometry, 0.5, 'raised-hub', 1);
applyPressingRelief(back, 0.5, 'raised-hub', -1);
for (let i = 0; i < base.length / 3; i++) assert.ok(Math.abs(geometry.getAttribute('position').getZ(i) + back.getAttribute('position').getZ(i)) < 1e-9);
console.log('Pressing rings: six distinct profiles including raised centre disc, continuous UVs, finite normals, stable switching, reversible Flat and mirrored relief passed.');
