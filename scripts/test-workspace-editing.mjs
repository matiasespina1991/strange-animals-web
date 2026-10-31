import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const model={};
vm.runInNewContext(compile(readFileSync('src/features/identity/design-configurator-model.ts','utf8')),{exports:model,crypto:globalThis.crypto});
const editor=readFileSync('src/features/identity/DesignConfiguratorEditor.tsx','utf8');
let current=structuredClone(model.initialDesign);
const id=current.A[0].id;
current.A[0].locked=true;
const saved=model.parseDesign(JSON.parse(JSON.stringify(current)));
assert.equal(saved.A[0].locked,true,'Position lock survives import/save');
const start=editor.indexOf('  const patchLayer =');
const end=editor.indexOf('  const beginLayerRename',start);
const scope={surface:'cookie',change:fn=>current=fn(current),updateSurfaceLayers:model.updateSurfaceLayers};
vm.createContext(scope);
vm.runInContext(compile(editor.slice(start,end)+'\nglobalThis.patch=patchLayer;'),scope);
const original={...current.A[0]};
scope.patch('A',id,{x:10,y:20,angle:80,radius:90,text:'still editable'});
for(const key of ['x','y','angle','radius']) assert.equal(current.A[0][key],original[key]);
assert.equal(current.A[0].text,'still editable');
scope.patch('A',id,{locked:false});scope.patch('A',id,{x:10});assert.equal(current.A[0].x,10);
let panStarted=false,selected='kept';
const panScope={panMode:true,Element:class{},viewOffset:{x:4,y:5},canvasPan:{current:null},
  end(){},setSelected:value=>selected=value,setSelectedLayers(){},setPanning:value=>panStarted=value};
vm.createContext(panScope);
const ps=editor.indexOf('  const startCanvasPan ='),pe=editor.indexOf('  const openSleevePreview',ps);
vm.runInContext(compile(editor.slice(ps,pe)+'\nglobalThis.pan=startCanvasPan;'),panScope);
panScope.pan({button:0,pointerId:2,clientX:100,clientY:150,target:{},currentTarget:{setPointerCapture(){}},preventDefault(){}});
assert.equal(panStarted,true);assert.equal(selected,'kept');assert.equal(panScope.canvasPan.current.offsetX,4);
assert.ok(editor.indexOf('{positionControls}',editor.indexOf('label="Ink bleed"'))<editor.indexOf('{slider("Rotation"',editor.indexOf('label="Ink bleed"')));
const image=editor.slice(editor.indexOf('dc-image-properties'));
assert.ok(image.indexOf('label="Width"')<image.indexOf('{positionControls}'));

// Exercise actual caret measurement with a minimal SVG geometry fixture.
let effect,line={attrs:{},style:{},setAttribute(key,value){this.attrs[key]=value;}};
const matrix={a:1,b:0,c:0,d:1,e:0,f:0,inverse(){return this;},multiply(){return this;}};
const text={getNumberOfChars:()=>6,getStartPositionOfChar:i=>({x:i*10,y:20}),getEndPositionOfChar:i=>({x:(i+1)*10,y:20}),getRotationOfChar:()=>0,getCTM:()=>matrix};
line.parentElement={querySelectorAll:()=>[text],getCTM:()=>matrix};
const caret={};
vm.runInNewContext(compile(readFileSync('src/features/identity/CanvasTextCaret.tsx','utf8')),{exports:caret,
  require:name=>name==='react'?{useRef:()=>({current:line}),useLayoutEffect:fn=>effect=fn}:{jsx:()=>null},
  document:{fonts:{ready:Promise.resolve(),addEventListener(){},removeEventListener(){}}}});
for(const [value,offset,x] of [['abcdef',3,30],['abc\ndef',3,30],['abcdef',6,60]]) {
  caret.CanvasTextCaret({layer:{text:value,size:20,kind:'text'},offset});const cleanup=effect();
  assert.ok(line.attrs.transform.includes(`translate(${x} 20)`));assert.equal(line.style.visibility,'visible');cleanup();
}
console.log('Workspace editing: pan mode, persistent position locks, guarded edits, property order and SVG insertion-point mirroring passed.');
