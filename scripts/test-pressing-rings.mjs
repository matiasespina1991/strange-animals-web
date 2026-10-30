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
assert.equal(PRESSING_PRESETS.length, 7);
const geometry = new THREE.RingGeometry(0.0365, 0.494, 256, 384);
const base = new Float32Array(geometry.getAttribute('position').array);
const uv = new Float32Array(geometry.getAttribute('uv').array);
const signatures = new Set();
for (const { id } of PRESSING_PRESETS) {
  const profile = Array.from({ length: 1000 }, (_, i) => pressingHeight(i / 2000, 0.5, id));
  assert.ok(profile.every(value => Number.isFinite(value) && Math.abs(value) < 0.0025));
  signatures.add(JSON.stringify(profile));
  if(id !== 'raised-hub' && id !== 'stepped-double') assert.equal(pressingHeight(0.0365, 0.5, id), 0, 'Existing profiles preserve the spindle rim');
  assert.equal(pressingHeight(0.494, 0.5, id), 0, 'No outer-edge seam');
  applyPressingRelief(geometry, 0.5, id, 1);
  assert.equal(Object.keys(geometry.userData).length, 0, 'No restoration buffers serialized as GLB extras');
  assert.deepEqual(geometry.getAttribute('uv').array, uv, 'Artwork UVs stay continuous');
  assert.ok([...geometry.getAttribute('normal').array].every(Number.isFinite));
  const once = new Float32Array(geometry.getAttribute('position').array);
  applyPressingRelief(geometry, 0.5, id, 1);
  assert.deepEqual(geometry.getAttribute('position').array, once, 'Repeated selection must not accumulate displacement');
}
assert.equal(signatures.size, 7, 'Distinct radial profiles');
assert.ok(pressingHeight(.2,.5,'stepped-double') < 0, 'Broad centre is recessed');
assert.ok(Math.abs(pressingHeight(.34,.5,'stepped-double')) <= .00008, 'Outside the broad shoulder only microgrooves remain');
const doubleCentre = pressingHeight(.0365,.5,'stepped-double');
assert.ok(doubleCentre > 0, 'Large central area is elevated');
for(let r=.0365;r<.1675;r+=.001) {
  assert.ok(Math.abs(pressingHeight(r,.5,'stepped-double')-doubleCentre)<=.00008+1e-12,'Central plateau retains its height with only shallow microgrooves');
}
let previousDoubleHeight = doubleCentre;
for(let r=.1705;r<=.1745;r+=.0001) {
  const height=pressingHeight(r,.5,'stepped-double');
  assert.ok(height<=previousDoubleHeight+1e-12,'Inner shoulder descends once without a groove');
  previousDoubleHeight=height;
}
assert.ok(Math.abs(pressingHeight(.2,.5,'stepped-double')+.0015)<=.00008,'Original outer recess retains its depth beneath microgrooves');
const marks = Array.from({length:2001},(_,i)=>{
  const r=.13+i/2000*.75;
  const base=-.0015*(1-THREE.MathUtils.smoothstep(r,.61,.64))
    +.0019*(1-THREE.MathUtils.smoothstep(r,.344,.346));
  return {r,depth:base-pressingHeight(r*.5,.5,'stepped-double')};
});
assert.ok(marks.every(mark=>mark.depth>=-1e-12 && mark.depth<.00005),'Marks remain shallow impressions');
const peaks=marks.filter((mark,i)=>i>0&&i<marks.length-1&&mark.depth>.000002&&mark.depth>marks[i-1].depth&&mark.depth>marks[i+1].depth);
assert.ok(peaks.length>8,'Several subtle tooling marks remain visible across the label');
const gaps=peaks.slice(1).map((mark,i)=>mark.r-peaks[i].r);
assert.ok(Math.max(...gaps)-Math.min(...gaps)>.01,'Spacing is irregular');
assert.ok(Math.max(...peaks.map(mark=>mark.depth))>Math.min(...peaks.map(mark=>mark.depth))*2,'Mark depths vary');
assert.ok(peaks.some(mark=>Math.abs(pressingHeight(mark.r*.5,.5,'stepped-double',1.2)-pressingHeight(mark.r*.5,.5,'stepped-double',0))>.000002),'Pressure varies around each arc');
for(const {id} of PRESSING_PRESETS) {
  const withMarks=peaks.map(mark=>pressingHeight(mark.r*.5,.5,id,0,true));
  const withoutMarks=peaks.map(mark=>pressingHeight(mark.r*.5,.5,id,0,false));
  assert.ok(withMarks.some((height,i)=>height<withoutMarks[i]-.000002),'Marks toggle works independently of the pressing preset');
}
applyPressingRelief(geometry,.5,'stepped-double',1,false);
const withoutMarks=new Float32Array(geometry.getAttribute('position').array);
applyPressingRelief(geometry,.5,'stepped-double',1,true);
assert.notDeepEqual(geometry.getAttribute('position').array,withoutMarks,'Enabling marks changes geometry');
applyPressingRelief(geometry,.5,'stepped-double',1,false);
assert.deepEqual(geometry.getAttribute('position').array,withoutMarks,'Disabling marks restores original pressing geometry exactly');
const hub=pressingHeight(.05,.5,'raised-hub');
assert.ok(hub>0);
assert.ok(Math.abs(hub-.00165*.7)<1e-12,'Central elevation reduced 30%');
assert.equal(pressingHeight(.0365,.5,'raised-hub'),hub,'Centre plateau extends to bore, without another inner groove');
assert.equal(pressingHeight(.12*.765,.5,'raised-hub'),hub,'Whole central disc is elevated');
assert.equal(pressingHeight(.15*.765,.5,'raised-hub'),hub,'Plateau extends farther before the steeper shoulder');
assert.ok(pressingHeight(.15625*.765,.5,'raised-hub')>0 && pressingHeight(.15625*.765,.5,'raised-hub')<hub,'Shorter, more pronounced shoulder');
assert.equal(pressingHeight(.16*.765,.5,'raised-hub'),0,'Surrounding label remains flat, no extra outer ring');
for(let r=0;r<.5;r+=.001) assert.ok(pressingHeight(r,.5,'raised-hub')>=0,'No engraved line around the plateau');
const smallHeight=r=>pressingHeight(r*.5,.5,'small');
assert.equal(smallHeight(.27),.0005,'Small ring is a shallow raised annulus');
assert.equal(smallHeight(.242),0);
assert.equal(smallHeight(.276),0);
for(let r=.1;r<.94;r+=.001) assert.ok(smallHeight(r)>=0&&smallHeight(r)<=.0005,'No recessed groove or tall hub');
assert.ok(smallHeight(.27)-smallHeight(.274)>3*(smallHeight(.27)-smallHeight(.266)),'Outer shoulder is steeper than the inner ramp');
applyPressingRelief(geometry, 0.5, 'flat', 1);
assert.deepEqual(geometry.getAttribute('position').array, base, 'Flat restores exact original surface');
const back = geometry.clone();
applyPressingRelief(geometry, 0.5, 'raised-hub', 1);
applyPressingRelief(back, 0.5, 'raised-hub', -1);
for (let i = 0; i < base.length / 3; i++) assert.ok(Math.abs(geometry.getAttribute('position').getZ(i) + back.getAttribute('position').getZ(i)) < 1e-9);
console.log('Pressing rings: seven distinct profiles including stepped double ring, continuous UVs, finite normals, stable switching, reversible Flat and mirrored relief passed.');
