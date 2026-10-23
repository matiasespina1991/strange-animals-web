import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync('src/features/identity/barcode-source-palette.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { barcodePaletteFromPixels } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const modelCode = ts.transpileModule(readFileSync('src/features/identity/design-configurator-model.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { barcodeSourceMatrix } = await import(`data:text/javascript;base64,${Buffer.from(modelCode).toString('base64')}`);
for (const expected of [{ bars: '#ffffff', background: '#000000' }, { bars: '#000000', background: '#ffffff' }, { bars: '#ff0000', background: '#00ffff' }]) {
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const pixels = new Uint8ClampedArray(10 * 10 * 4);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) pixels.set([...rgb(x === 4 || x === 6 ? expected.bars : expected.background), 255], (y * 10 + x) * 4);
  const palette = barcodePaletteFromPixels(pixels, 10, 10);
  assert.deepEqual(palette, expected);
  const matrix = barcodeSourceMatrix(palette).split(' ').map(Number);
  for (const [hex, value] of [[expected.bars, 0], [expected.background, 1]]) {
    const normalized = rgb(hex).reduce((sum, c, i) => sum + c / 255 * matrix[i], matrix[4]);
    assert.ok(Math.abs(normalized - value) < 1e-9, 'Black bars and white background must match the controls even with inverted source pixels');
  }
}
assert.throws(() => barcodePaletteFromPixels(new Uint8ClampedArray(400), 10, 10));
console.log('Barcode source palette: inverted, standard and custom sources map bars to black and background to white.');
