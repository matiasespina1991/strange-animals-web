import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync('src/features/identity/font-catalog-repository.ts', 'utf8');
const fn = source.slice(source.indexOf('export async function duplicateFontFamily('), source.indexOf('type FontPreviewDocument'))
  .replace('export ', '').replaceAll('import.meta.env.DEV', 'true');
const code = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
async function run(sizes, fail = false) {
  const uploads = [], writes = [], warnings = [], deleted = [];
  const docs = sizes.map((size, i) => ({ id: `f${i}`, data: () => ({ storagePath: `media/private/fonts/source/${i}`, fileName: `${i}.ttf`, extension: 'ttf', kind: 'font', sizeBytes: 999 }) }));
  const context = {
    FIRESTORE_BATCH_SIZE: 450, firebaseDb: {}, firebaseStorage: {},
    getDoc: async () => ({ exists: () => true, data: () => ({ name: 'Source', preview: { storagePath: 'media/private/fonts/source/0' } }) }),
    getDocs: async () => ({ size: docs.length, docs }),
    collection: () => ({}), doc: () => ({ id: 'copy' }), ref: (_, path) => path,
    getBytes: async path => new ArrayBuffer(sizes[Number(path.split('/').at(-1))]),
    uploadBytes: async (path, bytes) => { if (fail && uploads.length) throw new Error('Unauthorized'); uploads.push({ path, size: bytes.byteLength }); },
    serverTimestamp: () => 123,
    writeBatch: () => ({ set: (_, data) => writes.push(data), commit: async () => {} }),
    deleteDoc: async () => {}, deleteObject: async path => deleted.push(path),
    console: { warn: (...args) => warnings.push(args) },
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  let error;
  try { await context.duplicateFontFamily({ id: 'source', name: 'Source' }); } catch (cause) { error = cause; }
  return { uploads, writes, warnings, deleted, error };
}
const mixed = await run([0, 12, 0, 24]);
assert.equal(mixed.error, undefined);
assert.deepEqual(mixed.uploads.map(item => item.size), [12, 24]);
assert.equal(mixed.warnings.length, 2);
assert.equal(mixed.writes[0].fileCount, 2);
assert.equal(mixed.writes[0].variantCount, 2);
assert.match(mixed.writes[0].preview.storagePath, /f1/);
assert.equal(mixed.writes.length, 3, 'No documents for skipped files');
const empty = await run([0, 0]);
assert.match(empty.error.message, /no non-empty files/);
assert.equal(empty.writes.length, 0);
const denied = await run([12, 24], true);
assert.match(denied.error.message, /Unauthorized/);
assert.equal(denied.deleted.length, 1, 'Uploaded files rolled back on real errors');
console.log('Font duplication: empty files skipped with logs, accurate counts and preview, all-empty rejection, real permission errors and rollback passed.');
