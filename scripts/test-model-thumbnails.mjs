import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';

let downloads = 0, active = 0, maximum = 0, disposed = 0, renders = 0;
class Renderer {
  domElement = { toDataURL: () => 'data:image/png;base64,thumbnail' };
  setSize(width, height) { assert.equal(width, 256); assert.equal(height, 256); }
  setPixelRatio() {}
  setClearColor() {}
  render(scene, camera) {
    assert.ok(scene.children.some(child => child instanceof THREE.Group));
    assert.ok(camera instanceof THREE.OrthographicCamera);
    renders++;
  }
  dispose() { disposed++; }
  forceContextLoss() {}
}
class Loader {
  async parseAsync() {
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.03), new THREE.MeshStandardMaterial()));
    return { scene };
  }
}
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/features/identity/shared-model-thumbnail.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports, AbortSignal,
  require: name => name.includes('GLTFLoader') ? { GLTFLoader: Loader } : { ...THREE, WebGLRenderer: Renderer },
  fetch: async () => {
    downloads++;
    maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
  },
});
const first = exports.sharedModelThumbnail('model-one');
assert.equal(exports.sharedModelThumbnail('model-one'), first, 'Reuse pending thumbnail');
const results = await Promise.all([first, exports.sharedModelThumbnail('model-two')]);
assert.ok(results.every(result => result.startsWith('data:image/png;')));
assert.equal(maximum, 1, 'Never download/render several models at once');
assert.equal(downloads, 2);
assert.equal(renders, 2);
assert.equal(disposed, 2, 'Dispose offscreen renderers');
await exports.sharedModelThumbnail('model-one');
assert.equal(downloads, 2, 'Reuse captured image without downloading GLB again');
console.log('Model thumbnails: GLB capture, sequential queue, deduplication, image cache and GPU cleanup passed.');
