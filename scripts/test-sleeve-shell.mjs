import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/features/identity/sleeve-shell.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, require: name => name.includes('RoundedBoxGeometry') ? { RoundedBoxGeometry } : THREE });
const front = new THREE.Texture(), back = new THREE.Texture();
const shell = exports.createSleeveShell(3.15, 0.0236, 0.48, front, back, '#dddddd');
shell.updateMatrixWorld(true);
assert.equal(shell.children.length, 5);
const bounds = new THREE.Box3().setFromObject(shell);
assert.ok(Math.abs(bounds.max.z - bounds.min.z - 0.0236) < 1e-6);
const ray = (origin, direction) => new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction)).intersectObject(shell, true);
assert.equal(ray([2, 0, 0], [-1, 0, 0])[0]?.object.name, 'Spine fold', 'Open mouth must not have a solid right wall');
assert.equal(ray([0, 0, 2], [0, 0, -1]).length, 0, 'Center cutout stays open through both panels');
for (const [origin, direction, texture] of [[[1, 0, 2], [0, 0, -1], front], [[1, 0, -2], [0, 0, 1], back]]) {
  const hit = ray(origin, direction)[0];
  assert.ok(hit);
  assert.equal(hit.object.material[hit.face.materialIndex].map, texture, 'Correct artwork on outward face');
}
for (const mesh of shell.children) {
  const positions = mesh.geometry.getAttribute('position');
  for (const value of positions.array) assert.ok(Number.isFinite(value));
  if (mesh.geometry.type === 'ExtrudeGeometry') {
    assert.equal(mesh.geometry.parameters.options.bevelEnabled, true);
    assert.ok(mesh.geometry.parameters.options.bevelSize <= 0.0015, 'Paper-scale rounding, not a broad chamfer');
    assert.ok(mesh.geometry.groups.some(group => group.materialIndex === 0 && group.start > 0), 'Artwork covers curved outer edges');
  } else {
    assert.ok(mesh.material.every(material => material.map === front || material.map === back), 'Fold is printed, not a plain gray strip');
  }
}
assert.ok(shell.children[0].material[0].roughness > 0.7);
const component = readFileSync('src/features/identity/Sleeve3DPreview.tsx', 'utf8');
assert.match(component, /model.add\(createSleeveShell/);
assert.match(component, /new GLTFExporter\(\).parse\(\s*model,/);
console.log('Sleeve shell: thin dimensions, open right edge, center cutout, front/back textures, matte materials and shared export model passed.');
