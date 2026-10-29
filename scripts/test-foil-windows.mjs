import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve, dirname} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const require = createRequire(import.meta.url), cache = new Map();
function load(file) {
  if(cache.has(file)) return cache.get(file).exports;
  const module = {exports:{}}; cache.set(file,module);
  vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,
    {module,exports:module.exports,require:name=> {
      if(name.includes('RoundedBoxGeometry')) return {RoundedBoxGeometry};
      if(!name.startsWith('.')) return require(name);
      const base=resolve(dirname(file),name);return load(['.tsx','.ts'].map(ext=>base+ext).find(existsSync));
    }});
  return module.exports;
}
const base=resolve('src/features/identity');
const {initialDesign,parseDesign,hasSleeveWindow,textFoilColor,designReducer}=load(base+'/design-configurator-model.ts');
const {LabelArtwork}=load(base+'/LabelArtwork.tsx');
const {createSleeveShell}=load(base+'/sleeve-shell.ts');
const {createPrintedBoardGrain}=load(base+'/sleeve-material.ts');
const {foilCoveragePixels}=load(base+'/foil-material.ts');
const layer={...initialDesign.A[0],id:'foil',text:'FOIL',finish:'gold',visible:true};
assert.equal(initialDesign.sleeveMaterial,'printed-board');
assert.equal(parseDesign({...initialDesign,sleeveMaterial:undefined}).sleeveMaterial,'printed-board');
assert.equal(parseDesign({...initialDesign,sleeveMaterial:'invalid'}).sleeveMaterial,'printed-board');
assert.equal(parseDesign({...initialDesign,sleeveMaterial:'matte'}).sleeveMaterial,'matte');
assert.equal(parseDesign({...initialDesign,sleeveMaterial:'printed-board'}).sleeveMaterial,'printed-board');
const printedShell=createSleeveShell(3.15,.04,.48,new THREE.Texture(),new THREE.Texture(),'#000000',{A:true,B:false},'printed-board');
const printedMaterial=printedShell.children[0].material[0];
assert.equal(printedMaterial.metalness,0,'Printed board is not metallic');
assert.ok(printedMaterial.roughness>.4 && printedMaterial.roughness<.72,'Soft broad reflection, not glossy laminate');
assert.ok(printedMaterial.normalMap?.isDataTexture);
assert.equal(printedShell.children[1].material[0].normalMap,printedMaterial.normalMap);
assert.deepEqual([...createPrintedBoardGrain().image.data],[...createPrintedBoardGrain().image.data],'Grain is deterministic');
const design=parseDesign({...initialDesign,A:[layer],sleeveA:[layer],sleeveWindowA:false,sleeveWindowB:true});
assert.equal(hasSleeveWindow(design,'A'),false);assert.equal(hasSleeveWindow(design,'B'),true);
assert.equal(hasSleeveWindow(parseDesign({...initialDesign,sleeveWindowA:undefined}),'A'),true);
assert.equal(parseDesign(JSON.parse(JSON.stringify(design))).A[0].finish,'gold');
assert.equal(parseDesign({...design,A:[{...layer,finish:'evil',foilColor:'bad'}]}).A[0].finish,undefined);
assert.equal(textFoilColor({...layer,kind:'image'}),'#d6ad60');
assert.equal(parseDesign({...design,A:[{...layer,kind:'image',finish:'silver'}]}).A[0].finish,'silver');
for(const finish of ['gold','silver','copper','custom']) assert.match(textFoilColor({...layer,finish}),/^#[a-f0-9]{6}$/);
const props={design,side:'A',prefix:'foil-test',fontFamily:()=> 'Test'};
const preview=renderToStaticMarkup(React.createElement(LabelArtwork,props));
assert.match(preview,/linearGradient/);assert.match(preview,/fill="url\(#foil-test-foil-foil\)"/);
const mask=renderToStaticMarkup(React.createElement(LabelArtwork,{...props,finishMode:'mask'}));
assert.doesNotMatch(mask,/linearGradient|fill="#e5e8d9"/);assert.match(mask,/foil-white/);
const flat=renderToStaticMarkup(React.createElement(LabelArtwork,{...props,finishMode:'flat'}));
assert.doesNotMatch(flat,/linearGradient/);assert.match(flat,/fill="#d6ad60"/);
for (const kind of ['text','circular','image']) for (const finishMode of ['preview','flat','mask']) {
  const solidFoil=renderToStaticMarkup(React.createElement(LabelArtwork,{...props,finishMode,design:{...design,A:[{...layer,kind,opacity:0.2,blur:7,blendMode:'difference',image:'data:image/png;base64,AA=='}]}}));
  assert.doesNotMatch(solidFoil,/opacity="0.2"|blur\(7px\)|mix-blend-mode:difference/,'Foil ignores retained matte opacity, blur and contrast');
  assert.match(solidFoil,/data-layer-appearance="true" opacity="1"/);
}
for (const finishMode of ['preview','flat','mask']) {
  const imageArtwork=renderToStaticMarkup(React.createElement(LabelArtwork,{...props,finishMode,design:{...design,A:[{...layer,kind:'image',image:'data:image/png;base64,AA==',imageRatio:2,imageCrop:{top:5,bottom:5,left:5,right:5},borderRadius:8}]}}));
  assert.match(imageArtwork,/mask-type:alpha/,'Image foil uses transparency, not original RGB');
  assert.match(imageArtwork,/mask="url\(#foil-test-foil-image-foil\)"/);
  assert.match(imageArtwork,/clip-path="url\(#foil-test-image-crop-foil\)"/);
}
const covered=renderToStaticMarkup(React.createElement(LabelArtwork,{...props,finishMode:'mask',design:{...design,A:[layer,{...layer,id:'cover',finish:undefined}]}}));
assert.match(covered,/data-layer-id="cover" filter="url\(#foil-test-foil-black\)"/,'Foreground ink knocks out the reflective mask');
for(const kind of ['text','circular'])for(const textEffect of [undefined,{type:'extrusion',depth:8,angle:35,steps:4}]) {
  const artwork=renderToStaticMarkup(React.createElement(LabelArtwork,{...props,design:{...design,A:[{...layer,kind,radius:150,textEffect}]}}));
  assert.match(artwork,/foil-test-foil-foil/);
  assert.doesNotMatch(artwork,/NaN|undefined/);
}
let history={past:[],present:initialDesign,future:[]};
history=designReducer(history,{type:'change',change:()=>design});
history=designReducer(history,{type:'undo'});assert.equal(hasSleeveWindow(history.present,'A'),true);
for(const A of [false,true])for(const B of [false,true]) {
  const shell=createSleeveShell(3.15,.04,.48,new THREE.Texture(),new THREE.Texture(),'#ffffff',{A,B});
  shell.updateMatrixWorld(true);
  for(const [index,open,origin,direction] of [[0,A,1,-1],[1,B,-1,1]]) {
    const hits=new THREE.Raycaster(new THREE.Vector3(0,0,origin),new THREE.Vector3(0,0,direction)).intersectObject(shell.children[index]);
    assert.equal(hits.length===0,open,`Independent physical window on panel ${index}`);
  }
}
const coverage=foilCoveragePixels(new Uint8ClampedArray([255,255,255,255,0,0,0,255,255,255,255,0,255,255,255,128,64,64,64,255]));
assert.equal(coverage[3],255); assert.equal(coverage[7],0); assert.equal(coverage[11],0);
assert.equal(coverage[15],128); assert.equal(coverage[19],64,'Edge coverage remains smooth, not thresholded or expanded');
for (let i=0;i<coverage.length;i+=4) assert.equal(coverage[i],255,'Color remains constant even outside foil coverage');
const bare=renderToStaticMarkup(React.createElement(LabelArtwork,{...props,finishMode:'base'}));
assert.doesNotMatch(bare,/data-layer-id="foil"/,'Paper capture must not contain baked foil fringes');
const source=readFileSync(base+'/Sleeve3DPreview.tsx','utf8');
assert.match(source,/scene.environment = environment.texture/);assert.match(source,/foilMasks\?\.sleeveB, true, true/);
assert.match(source,/surface.add\(foil\)/); assert.match(source,/material.alphaMap\?\.dispose/);
assert.match(source,/printGroupsOnly \? \[material\] : material/,'Sleeve overlay respects print-only geometry groups');
const foilSource=readFileSync(base+'/foil-material.ts','utf8');
assert.match(foilSource,/material.metalness = 1/); assert.match(foilSource,/material.roughness = 0.035/);
assert.match(foilSource,/material.map = silhouette/,'Use base color alpha supported by glTF');
assert.doesNotMatch(foilSource,/material.metalnessMap =|material.roughnessMap =/);
const exporter=readFileSync(base+'/design-configurator-export.tsx','utf8');
const printArtwork=renderToStaticMarkup(React.createElement(LabelArtwork,{...props,cutCenter:false}));
assert.doesNotMatch(printArtwork,/clip-rule="evenodd"/,'Print trim keeps the spindle center filled');
assert.match(preview,/clip-rule="evenodd"/,'Preview retains the physical spindle opening');
assert.match(exporter,/cutCenter=\{cutCenter\}/);
assert.match(exporter,/includeBleed, "mask", false/,'Foil print plates also retain center artwork');
const editor=readFileSync(base+'/DesignConfiguratorEditor.tsx','utf8');
assert.match(editor,/createLabelSvg\(design, s, fonts, includeBleed, "preview", false\)/);
const psd=readFileSync(base+'/design-configurator-psd.ts','utf8');
assert.doesNotMatch(psd,/design.holeMm/,'PSD print layers must not punch out the spindle hole');
assert.equal((exporter.match(/if \(hasSleeveWindow\(design, side\)\) root.append\(label\)/g)||[]).length,2);
assert.match(exporter,/if \(hasSleeveWindow\(design, side\)\) cardboardMask.append\(cookieCutout\)/);
assert.match(exporter,/ink.setAttribute\("fill", "#000000"\)/);
assert.match(exporter,/mask-type:luminance/);
console.log('Foil/windows: persistence, SVG/alpha masks, separate metal overlay, clean paper capture, four window combinations and GPU disposal passed.');
