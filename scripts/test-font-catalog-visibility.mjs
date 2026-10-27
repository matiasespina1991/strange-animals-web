import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/features/identity/font-catalog-visibility.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports });
const fonts = [{ id: 'enabled', enabled: true }, { id: 'dome', enabled: false }, { id: 'unset' }];
for (const host of ['localhost', '127.0.0.1', '[::1]', '::1']) {
  assert.deepEqual(exports.visibleFontCatalog(fonts, host), fonts);
}
for (const host of ['strangeanimals.de', 'www.strangeanimals.de', 'preview.web.app', 'localhost.example.com', '192.168.1.2', '']) {
  assert.deepEqual(exports.visibleFontCatalog(fonts, host), [fonts[0]]);
}
assert.equal(fonts.length, 3);
console.log('Font visibility: disabled/unset families hidden on hosted sites, available on loopback hosts; input unchanged.');
