import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/features/identity/cookie-core-geometry.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports, require: () => THREE });
for (const hole of [0.0365, 0.05, 0.1]) {
  const geometry = exports.createCookieCoreGeometry(0.5, hole, 0.0096, 0.006, 0.002);
  const position = geometry.getAttribute('position');
  assert.ok(geometry.groups.some(group => group.materialIndex === 1), 'Separate colored outer rim');
  assert.ok(geometry.groups.some(group => group.materialIndex === 2), 'Separate black bore');
  for (const group of geometry.groups.filter(group => group.materialIndex === 2)) {
    for (let i = group.start; i < group.start + group.count; i++) {
      assert.ok(Math.hypot(position.getX(i), position.getY(i)) < 0.2, 'Black material confined to center bore');
    }
  }
  let minimumRadius = Infinity;
  for (let i = 0; i < position.count; i++) minimumRadius = Math.min(minimumRadius, Math.hypot(position.getX(i), position.getY(i)));
  assert.ok(minimumRadius >= hole - 1e-5, 'Black bevel must not protrude into printed hole');
  const core = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  core.updateMatrixWorld();
  assert.equal(new THREE.Raycaster(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)).intersectObject(core).length, 0);
  const print = new THREE.Mesh(new THREE.RingGeometry(hole, 0.494, 128), new THREE.MeshBasicMaterial());
  print.position.z = 0.0058;
  print.updateMatrixWorld();
  const ray = new THREE.Raycaster(new THREE.Vector3(hole + 0.001, 0, 1), new THREE.Vector3(0, 0, -1));
  assert.equal(ray.intersectObjects([core, print])[0].object, print, 'Print covers surface next to hole');
  geometry.dispose();
}
console.log('Cookie hole: no black core intrusion, open center and print extending to opening passed.');
