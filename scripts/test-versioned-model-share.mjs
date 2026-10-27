import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';
const records = new Map(), objects = new Map(), deleted = [];
const accountAuth = { app: {}, currentUser: { uid: 'owner' } };
let rejectCommit = false, timestamp = 0;
const firestore = {
  getFirestore: () => ({}), doc: (_db, _collection, id) => id,
  getDoc: async id => ({ exists: () => records.has(id), data: () => records.get(id) }),
  serverTimestamp: () => ({ ordinal: ++timestamp }),
  setDoc: async (id, data) => { if (rejectCommit) throw Error('Commit failed'); records.set(id, data); },
};
const storage = {
  getStorage: () => ({}), ref: (_store, path) => path,
  uploadBytesResumable: (path, file, metadata) => ({ on: (_event, progress, _error, complete) => {
    objects.set(path, { file, metadata }); progress({ bytesTransferred: file.size, totalBytes: file.size }); complete();
  } }),
  deleteObject: async path => { deleted.push(path); objects.delete(path); },
};
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/features/ar-model/model-share-repository.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, crypto: { randomUUID }, require: name => name === 'firebase/firestore' ? firestore : name === 'firebase/storage' ? storage : { accountAuth } });
const version = randomUUID(), nextVersion = randomUUID();
const file = new File(['binary'], 'artwork.glb');
const first = await exports.createModelShare(file, 'Version one', undefined, version);
const originalCreated = records.get(version).createdAt;
const second = await exports.createModelShare(new File(['updated binary'], 'renamed.glb'), 'Updated version one', undefined, version);
assert.equal(first.id, second.id);
assert.equal(first.storagePath, second.storagePath);
assert.equal(records.size, 1);
assert.equal(objects.size, 1);
assert.equal(records.get(version).createdAt, originalCreated);
assert.equal(records.get(version).title, 'Updated version one');
assert.equal(objects.get(first.storagePath).metadata.cacheControl, 'no-cache, max-age=0');
assert.equal((await exports.createModelShare(file, 'Version two', undefined, nextVersion)).id, nextVersion);
assert.equal(records.size, 2);
accountAuth.currentUser = { uid: 'someone-else' };
await assert.rejects(exports.createModelShare(file, 'Hijack', undefined, version), /cannot be replaced/);
assert.equal(objects.size, 2);
accountAuth.currentUser = { uid: 'owner' };
rejectCommit = true;
await assert.rejects(exports.createModelShare(file, 'Retry', undefined, version), /Commit failed/);
assert.equal(deleted.length, 0, 'Failure must not delete an existing version model');
assert.ok(objects.has(first.storagePath));
await assert.rejects(exports.createModelShare(file, 'Invalid', undefined, '../bad'), /Invalid model version ID/);
const editor = readFileSync('src/features/identity/DesignConfiguratorEditor.tsx', 'utf8');
assert.match(editor, /setGalleryVersionId\(saved.versionId\)/);
assert.match(editor, /setGalleryVersionId\(versionId\)/);
assert.match(editor, /modelShareId=\{galleryVersionId \?\? draftModelId\}/);
console.log('Version shares: stable ID/path, same-version replacement, different versions separated, timestamps preserved, owner checks, cache control and safe failure passed.');
