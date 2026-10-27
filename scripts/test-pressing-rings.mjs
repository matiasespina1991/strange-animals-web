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
assert.equal(PRESSING_PRESETS.length, 5);
const geometry = new THREE.RingGeometry(0.0365, 0.494, 256, 192);
const base = new Float32Array(geometry.getAttribute('position').array);
const uv = new Float32Array(geometry.getAttribute('uv').array);
const signatures = new Set();
for (const { id } of PRESSING_PRESETS) {
  const profile = Array.from({ length: 1000 }, (_, i) => pressingHeight(i / 2000, 0.5, id));
  assert.ok(profile.every(value => Number.isFinite(value) && Math.abs(value) < 0.001));
  signatures.add(JSON.stringify(profile));
  assert.equal(pressingHeight(0.0365, 0.5, id), 0, 'No change to spindle bore');
  assert.equal(pressingHeight(0.494, 0.5, id), 0, 'No outer-edge seam');
  applyPressingRelief(geometry, 0.5, id, 1);
  assert.equal(Object.keys(geometry.userData).length, 0, 'No restoration buffers serialized as GLB extras');
  assert.deepEqual(geometry.getAttribute('uv').array, uv, 'Artwork UVs stay continuous');
  assert.ok([...geometry.getAttribute('normal').array].every(Number.isFinite));
  const once = new Float32Array(geometry.getAttribute('position').array);
  applyPressingRelief(geometry, 0.5, id, 1);
  assert.deepEqual(geometry.getAttribute('position').array, once, 'Repeated selection must not accumulate displacement');
}
assert.equal(signatures.size, 5, 'Distinct radial profiles');
applyPressingRelief(geometry, 0.5, 'flat', 1);
assert.deepEqual(geometry.getAttribute('position').array, base, 'Flat restores exact original surface');
const back = geometry.clone();
applyPressingRelief(geometry, 0.5, 'raised', 1);
applyPressingRelief(back, 0.5, 'raised', -1);
for (let i = 0; i < base.length / 3; i++) assert.ok(Math.abs(geometry.getAttribute('position').getZ(i) + back.getAttribute('position').getZ(i)) < 1e-9);
console.log('Pressing rings: five distinct profiles, continuous UVs, finite normals, stable switching, reversible Flat, mirrored relief and preserved openings passed.');
