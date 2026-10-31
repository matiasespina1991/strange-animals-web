import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const exports = {};
const materials = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/features/identity/sleeve-material.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {exports:materials,require:()=>THREE});
vm.runInNewContext(ts.transpileModule(readFileSync('src/features/identity/sleeve-shell.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, require: name => name.includes('RoundedBoxGeometry') ? { RoundedBoxGeometry } : name === './sleeve-material' ? materials : THREE });
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
assert.match(component, /const shell = createSleeveShell/);
assert.match(component, /model.add\(shell\)/);
const shoulderStart = component.indexOf('    for (const face of [1, -1])');
const shoulderEnd = component.indexOf('\n    if (sleeveImage)', shoulderStart);
assert.ok(shoulderStart > 0 && shoulderEnd > shoulderStart);
const model = new THREE.Group();
vm.runInNewContext(component.slice(shoulderStart, shoulderEnd), {
  THREE, model, cookieRecessInnerRadius: 0.4935,
  cookieRecessOpeningRadius: 0.5055, cookieDepth: 0.0096,
  labelRadius: .5, cookieBevelSize: .006, vinylSurfaceZ: .0073,
  sleeveDepth: 0.0336, labelColor: '#dddddd',
  VINYL_DIAMETER_MM: 304.8, WORLD_SCALE: .01,
});
model.updateMatrixWorld(true);
assert.equal(model.children.length, 3, 'Two planar faces and a closed record edge');
for (const shoulder of model.children.slice(0,2)) {
  assert.equal(shoulder.material.color.getHex(), 0x121212, 'Recess union represents black vinyl, not label ink');
  const positions=shoulder.geometry.getAttribute('position');
  const normals=shoulder.geometry.getAttribute('normal');
  const z=positions.getZ(0);
  for(let i=0;i<positions.count;i++) {
    assert.equal(positions.getZ(i),z,'Vinyl stays planar from the label to beneath the sleeve');
    assert.ok(Math.abs(normals.getX(i))<1e-6&&Math.abs(normals.getY(i))<1e-6,'No bevel normals produce a silver band');
    assert.ok(Math.abs(normals.getZ(i)-Math.sign(z))<1e-6,'Both vinyl faces point outward, including side B in AR');
  }
  assert.ok(Math.abs(Math.abs(z)-.0073)<1e-8,'Vinyl strip is coplanar with the label, below the sleeve');
  assert.ok(shoulder.material.roughness<.25&&shoulder.material.metalness===0,'Glossy vinyl remains nonmetallic');
}
const edgeBounds=new THREE.Box3().setFromObject(model.children[2]);
assert.ok(Math.abs(edgeBounds.max.z-.0073)<1e-7&&Math.abs(edgeBounds.min.z+.0073)<1e-7,'Record edge joins the flat faces at the same thickness');
for (const face of [1, -1]) {
  const shoulder=model.children[face===1?0:1];
  const originalSide=shoulder.material.side;
  shoulder.material.side=THREE.FrontSide;
  for (const radius of [0.4941, 0.499, 0.505, 0.506, 1, 1.52]) {
    const hits = new THREE.Raycaster(new THREE.Vector3(radius, 0, face), new THREE.Vector3(0, 0, -face)).intersectObject(shoulder);
    assert.ok(hits.length, `Recess shoulder must close the gap at radius ${radius} on face ${face}`);
  }
  shoulder.material.side=originalSide;
}
const straightShell=exports.createSleeveShell(3.15,.0336,.5055,front,back,'#222222',{A:true,B:true},'matte',.0073);
straightShell.updateMatrixWorld(true);
for (const face of [1,-1]) {
  const name=face===1?'Front vertical window cut':'Back vertical window cut';
  const wall=straightShell.getObjectByName(name);
  assert.ok(wall,'Each opening has a straight cut wall');
  const positions=wall.geometry.getAttribute('position');
  const normals=wall.geometry.getAttribute('normal');
  for(let i=0;i<positions.count;i++) {
    assert.ok(Math.abs(Math.hypot(positions.getX(i),positions.getY(i))-.5055)<1e-6,'Constant radius: no sloping shoulder');
    assert.ok(Math.abs(normals.getZ(i))<1e-6,'Wall normals are horizontal');
  }
  const bounds=new THREE.Box3().setFromObject(wall);
  assert.ok(Math.abs((face===1?bounds.min.z:-bounds.max.z)-.0073)<1e-7,'Cut ends exactly on the vinyl plane');
  assert.ok(Math.abs((face===1?bounds.max.z:-bounds.min.z)-.0168)<1e-7,'Cut starts on sleeve outer face');
}
const closedShell=exports.createSleeveShell(3.15,.0336,.5055,front,back,'#222222',{A:false,B:true},'matte',.0073);
assert.equal(closedShell.getObjectByName('Front vertical window cut'),undefined,'Closed sleeve has no window wall');
assert.match(component, /new GLTFExporter\(\).parse\(\s*prepareVinylModelExport\(model\),/);
console.log('Sleeve shell: thin dimensions, open right edge, center cutout, front/back textures, matte materials and shared export model passed.');
