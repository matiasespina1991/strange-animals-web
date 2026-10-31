import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync('src/features/identity/recovery-diagnostics.ts', 'utf8');
const exports = {}, logs = [];
const entries = new Map([['draft', 'old'], ['other', '1234']]);
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText, {exports, Blob, Error, navigator: {storage: {estimate: async () => ({usage: 25, quota: 100})}},
  localStorage: {length: entries.size, key: index => [...entries.keys()][index], getItem: key => entries.get(key)},
  console: {error: (...args) => logs.push(args), info: (...args) => logs.push(args), warn: (...args) => logs.push(args)}});
const error = new Error('quota exceeded'); error.name = 'QuotaExceededError';
exports.reportRecoveryFailure(error, 'PRIVATE_IMAGE_DATA', 'draft');
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(logs[0][0], '[StudioShelf/recovery] write-failed');
assert.equal(logs[0][1].errorName, 'QuotaExceededError');
assert.equal(logs[0][1].projectUtf16Bytes, 36);
assert.equal(logs[0][1].existingRecoveryUtf16Bytes, 6);
assert.equal(logs[0][1].cloudSaveAffected, false);
assert.ok(!JSON.stringify(logs).includes('PRIVATE_IMAGE_DATA'));
assert.equal(logs[1][1].quotaBytes, 100);
console.log('Recovery diagnostics: error, byte counts, quota distinction and no artwork leakage passed.');
