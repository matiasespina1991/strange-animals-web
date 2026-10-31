import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {randomUUID} from 'node:crypto';
class HttpsError extends Error { constructor(code,message){super(message);this.code=code;} }
const records=new Map(), objects=new Map();
const db={};
const ref=path=>({path,collection:name=>({doc:id=>ref(`${path}/${name}/${id}`)})});
const snapshot=path=>({exists:records.has(path),existsFn:()=>records.has(path),
  get:key=>records.get(path)?.[key],data:()=>records.get(path)});
db.doc=ref;
db.runTransaction=async callback=>{
  const writes=[];
  const result=await callback({get:async reference=>snapshot(reference.path),
    update:(reference,data)=>writes.push([reference.path,data])});
  for(const [path,data] of writes)records.set(path,{...records.get(path),...data});
  return result;
};
const adminExports={};
vm.runInNewContext(ts.transpileModule(readFileSync('functions/src/design-version-save.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{exports:adminExports,require:name=>{
  if(name==='firebase-admin/firestore')return {FieldValue:{delete:()=>undefined,serverTimestamp:()=>123}};
  if(name==='firebase-functions/v2/https')return {HttpsError};
  if(name==='./design-gallery-service')return {projectInput:(uid,data)=>{
    if(!uid)throw new HttpsError('unauthenticated','Sign in');
    return {uid,projectId:data.projectId,data};
  }};
  throw Error(name);
}});
const owner='owner',projectId=randomUUID(),versionId=randomUUID(),olderId=randomUUID();
const projectPath=`designUsers/${owner}/projects/${projectId}`;
const versionPath=`${projectPath}/versions/${versionId}`;
records.set(projectPath,{title:'Design',latestVersion:2,latestVersionId:versionId,createdAt:1,frontPreviewPath:'old-front'});
records.set(versionPath,{version:2,createdAt:2,designPath:'old-design',modelPath:'old-model'});
records.set(`${projectPath}/versions/${olderId}`,{version:1,createdAt:1,designPath:'older-design'});
const bucket={file:path=>({getMetadata:async()=>[{contentType:path.endsWith('.json')?'application/json':'image/png',size:10}]})};
const input={projectId,versionId,uploadId:randomUUID(),expectedDesignPath:'old-design',expectedTitle:'Design',title:'Design'};
await assert.rejects(adminExports.overwriteGalleryVersion(db,bucket,undefined,input),{code:'unauthenticated'});
await assert.rejects(adminExports.overwriteGalleryVersion(db,bucket,'other',input),{code:'failed-precondition'});
await assert.rejects(adminExports.overwriteGalleryVersion(db,bucket,owner,{...input,uploadId:'../invalid'}),{code:'invalid-argument'});
await assert.rejects(adminExports.overwriteGalleryVersion(db,bucket,owner,{...input,expectedDesignPath:'stale'}),{code:'aborted'});
assert.equal(records.get(versionPath).designPath,'old-design');
await adminExports.overwriteGalleryVersion(db,bucket,owner,input);
assert.equal(records.size,3,'Normal save creates no version document');
assert.equal(records.get(projectPath).latestVersion,2);
assert.equal(records.get(projectPath).latestVersionId,versionId);
assert.equal(records.get(versionPath).version,2);
assert.equal(records.get(versionPath).createdAt,2);
assert.match(records.get(versionPath).designPath,new RegExp(input.uploadId));
assert.equal(records.get(versionPath).modelPath,undefined,'Private cached GLB invalidated');
const latestPreview=records.get(projectPath).frontPreviewPath;
await adminExports.overwriteGalleryVersion(db,bucket,owner,{...input,versionId:olderId,uploadId:randomUUID(),expectedDesignPath:'older-design'});
assert.equal(records.get(projectPath).frontPreviewPath,latestPreview,'Saving an older version does not promote it');
assert.equal(records.get(projectPath).latestVersionId,versionId);
records.get(projectPath).status='deleting';
await assert.rejects(adminExports.overwriteGalleryVersion(db,bucket,owner,{...input,uploadId:randomUUID()}),{code:'failed-precondition'});
delete records.get(projectPath).status;

// Exercise the actual client repository against isolated SDK fakes.
const clientExports={};
const firestore={getFirestore:()=>db,doc:(_db,...parts)=>ref(parts.join('/')),
  collection:(_db,...parts)=>parts.join('/'),
  getDoc:async reference=>({...snapshot(reference.path),exists:()=>records.has(reference.path)}),
  serverTimestamp:()=>123,runTransaction:async(_db,callback)=>{
    const writes=[];
    await callback({get:firestore.getDoc,update:(reference,data)=>writes.push([reference.path,data]),
      set:(reference,data)=>writes.push([reference.path,data])});
    for(const [path,data] of writes)records.set(path,{...records.get(path),...data});
  }};
const clientSource=readFileSync('src/features/identity/design-gallery-repository.ts','utf8').replaceAll('import.meta.env.DEV','false');
vm.runInNewContext(ts.transpileModule(clientSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports:clientExports,Blob,console,crypto:{randomUUID},require:name=>{
    if(name==='firebase/firestore')return firestore;
    if(name==='firebase/storage')return {getStorage:()=>({}),ref:(_s,path)=>path,
      uploadBytes:async(path,blob)=>objects.set(path,blob),deleteObject:async path=>objects.delete(path)};
    if(name==='firebase/functions')return {getFunctions:()=>({}),httpsCallable:()=>async data=>adminExports.overwriteGalleryVersion(db,bucket,owner,data)};
    if(name==='./account-auth')return {accountAuth:{app:{}}};
    if(name==='./settle-uploads')return {settleUploads:promises=>Promise.all(promises)};
    if(name==='./design-configurator-model')return {};
    throw Error(name);
  },
});
const png=new Blob(['png'],{type:'image/png'});
const args={uid:owner,design:{title:'Design'},projectId,currentVersionId:versionId,
  frontPreview:png,backPreview:png,frontSleevePreview:png,backSleevePreview:png};
const saved=await clientExports.saveGalleryVersion(args);
assert.equal(saved.versionId,versionId);assert.equal(saved.version,2);assert.equal(records.size,3);
const count=objects.size;
await assert.rejects(clientExports.saveGalleryVersion({...args,expectedDesignPath:'stale'}),/changed/);
assert.equal(objects.size,count,'Stale editor rejected before uploading');
const next=await clientExports.saveGalleryVersion({...args,asNewVersion:true});
assert.notEqual(next.versionId,versionId);assert.equal(next.version,3);assert.equal(records.size,4);
const fresh=await clientExports.saveGalleryVersion({...args,asNewProject:true});
assert.notEqual(fresh.project.id,projectId);assert.equal(fresh.version,1);
const editor=readFileSync('src/features/identity/DesignConfiguratorEditor.tsx','utf8');
assert.match(editor,/saveToGallery\(false, true\)/);
console.log('Save modes: overwrite stable identity, explicit new version/project, immutable staging, CAS, owner/deletion checks and older-version isolation passed.');
