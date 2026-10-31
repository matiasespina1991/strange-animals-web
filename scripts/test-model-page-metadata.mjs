import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
let requests = [], replies = [];
vm.runInNewContext(ts.transpileModule(readFileSync('functions/src/model-page-metadata.ts','utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText, {exports, AbortSignal, Buffer, console,
  fetch: async url => { requests.push(url); return replies.shift(); },
  require: () => ({onRequest: (_options, handler) => handler})});
const id='176557a2-579b-4057-a3a0-7ff60ff49456';
const metadata=exports.modelPageMetadata(id,'Artwork <test> & "sample"');
const html=exports.applyModelMetadata(readFileSync('index.html','utf8'),metadata);
assert.match(html, /3D MODEL \| Strange Animals \| Artwork &lt;test&gt; &amp; &quot;sample&quot;/);
assert.match(html, new RegExp(`content="https://strangeanimals.de/_model-preview/${id}"`));
assert.match(html, /Interactive 3D view of Artwork &lt;test&gt;/);
assert.match(html, new RegExp(`rel="canonical" href="https://strangeanimals.de/${id}"`));
assert.match(html, /name="twitter:card" content="summary_large_image"/);
assert.doesNotMatch(html, /<test>/);
const hosting=JSON.parse(readFileSync('firebase.json','utf8')).hosting.rewrites;
assert.equal(hosting[0].destination,'/index.html','Opening a model must work even if the optional SEO function is unavailable');
assert.ok(new RegExp(hosting[0].regex).test('/'+id));
assert.ok(!new RegExp(hosting[0].regex).test('/listen/sajs001'));
function response() {
  return {statusCode:200, headers:{}, body:null,
    set(key,value){this.headers[key]=value;return this;},
    status(value){this.statusCode=value;return this;},
    type(value){this.headers['Content-Type']=value;return this;},
    send(value){this.body=value;return this;},
    redirect(code,url){this.statusCode=code;this.headers.Location=url;return this;},
  };
}
let res=response();
await exports.sharedModelPage({method:'GET',path:'/not-a-model'},res);
assert.equal(res.statusCode,404);assert.equal(requests.length,0);
replies=[{status:403}];res=response();
await exports.sharedModelPage({method:'GET',path:'/'+id},res);
assert.equal(res.statusCode,404,'Denied documents never reveal metadata');
const publicDoc={ok:true,status:200,json:async()=>({fields:{visibility:{stringValue:'public'},title:{stringValue:'Sample'},ownerUid:{stringValue:'owner'}}})};
replies=[publicDoc,{status:404}];res=response();
await exports.sharedModelPage({method:'GET',path:'/_model-preview/'+id},res);
assert.equal(res.statusCode,302,'Legacy model without a capture uses the brand fallback');
assert.match(res.headers.Location,/SALOGO2.png$/);
replies=[publicDoc,{ok:true,text:async()=>readFileSync('index.html','utf8')}];res=response();
await exports.sharedModelPage({method:'GET',path:'/'+id},res);
assert.equal(res.statusCode,200);assert.match(res.body,/3D MODEL \| Strange Animals \| Sample/);
assert.match(requests.at(-1),/\/route-meta\/model-shell.html$/,'Template fetch cannot recurse into the model route');
console.log('Model SEO: initial HTML, escaped title/description, preview image, canonical, Twitter card and isolated Hosting route passed.');
