import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import opentype from "opentype.js";
import { readPsd, writePsd } from "ag-psd";

const code = ts.transpileModule(await readFile(new URL("../src/features/identity/psd-vector-paths.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { psdPaths } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const resolutionCode = ts.transpileModule(await readFile(new URL("../src/features/identity/print-resolution.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { PRINT_PPI, printPixelSize } = await import(`data:text/javascript;base64,${Buffer.from(resolutionCode).toString("base64")}`);
assert.equal(PRINT_PPI, 600);
assert.equal(printPixelSize(100), 2362);
assert.equal(printPixelSize(106), 2504, "Include bleed before calculating the output pixel size");
const square = psdPaths([{ type: "M", x: 1, y: 1 }, { type: "L", x: 5, y: 1 }, { type: "L", x: 5, y: 5 }, { type: "L", x: 1, y: 1 }, { type: "Z" }], (x, y) => [x * 2, y * 2]);
assert.equal(square.length, 1);
assert.equal(square[0].knots.length, 3);
assert.deepEqual(square[0].knots[1].points, [10, 2, 10, 2, 10, 2]);
const quadratic = psdPaths([{ type: "M", x: 0, y: 0 }, { type: "Q", x1: 3, y1: 3, x: 6, y: 0 }, { type: "Z" }], (x, y) => [x, y]);
assert.deepEqual(quadratic[0].knots[0].points.slice(4), [2, 2]);
assert.deepEqual(quadratic[0].knots[1].points.slice(0, 2), [4, 2]);
const fontBytes = await readFile(new URL("../public/media/fonts/BerlinType-Bold.otf", import.meta.url));
const font = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));
const outlines = psdPaths(font.getPath("OTHER", 0, 12, 10).commands, (x, y) => [x, y]);
assert.ok(outlines.length > 5, "Export glyph contours, not a flattened text bitmap");
const pixel = { width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255]) };
const bytes = writePsd({ width: 32, height: 32, imageData: { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) },
  children: [{ name: "Text outlines", imageData: pixel, vectorFill: { type: "color", color: { r: 0, g: 0, b: 0 } }, vectorMask: { paths: outlines } },
    { name: "Hidden image", hidden: true, imageData: pixel }],
});
const result = readPsd(bytes, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
assert.equal(result.children.length, 2);
assert.equal(result.children[0].vectorMask.paths.length, outlines.length);
assert.equal(result.children[1].hidden, true);
assert.equal(result.children[0].text, undefined, "Outlined text must not depend on installed Photoshop fonts");
const fallbackCode = ts.transpileModule(await readFile(new URL("../src/features/identity/psd-glyph-fallback.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const fallbackModule = `data:text/javascript;base64,${Buffer.from(fallbackCode).toString("base64")}`;
const { outlineGlyph } = await import(fallbackModule);
const dinBytes = await readFile(new URL("../public/media/fonts/Alte%20DIN%201451%20Mittelschrift%20gepraegt%20Regular.ttf", import.meta.url));
const din = opentype.parse(dinBytes.buffer.slice(dinBytes.byteOffset, dinBytes.byteOffset + dinBytes.byteLength));
assert.equal(din.charToGlyph("⅓").index, 0);
assert.ok(font.charToGlyph("⅓").index);
assert.equal(outlineGlyph(din, "⅓", [{ family: "Berlin Type Office", font }]).fallbackFamily, "Berlin Type Office");
assert.equal(outlineGlyph(font, "A", [{ family: "DIN", font: din }]).fallbackFamily, undefined, "Existing glyphs must retain the chosen font");
assert.throws(() => outlineGlyph(din, "⅓"), /default fonts/);
const outlineSource = ts.transpileModule(await readFile(new URL("../src/features/identity/psd-text-outlines.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace('"./psd-glyph-fallback"', JSON.stringify(fallbackModule))
  .replace('"opentype.js"', JSON.stringify(`data:text/javascript;base64,${Buffer.from(`import opentype from ${JSON.stringify(import.meta.resolve("opentype.js"))}; export const parse=opentype.parse;`).toString("base64")}`))
  .replace('"./psd-vector-paths"', JSON.stringify(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`));
const { embeddedOutlineFonts, outlineText } = await import(`data:text/javascript;base64,${Buffer.from(outlineSource).toString("base64")}`);
const decodedFonts = embeddedOutlineFonts({ querySelector: () => ({ textContent: `@font-face{font-family:"Fixture";src:url(data:font/otf;base64,${fontBytes.toString("base64")}) format('opentype');}` }) });
assert.equal(decodedFonts.size, 1, "Decode embedded font bytes instead of relying on locally installed fonts");
const previousDocument = globalThis.document;
try {
  globalThis.document = { createElementNS: () => ({ setAttribute() {}, append() {} }) };
  const lines = ["01  AFTER HOURS       06:42", "02  NO FIXED ADDRESS  05:18"];
  const normalized = lines.map((line) => line.replace(/ +/g, " ")).join("");
  const positions = [];
  const text = {
    textContent: lines.join(""),
    parentElement: { getAttribute: () => null },
    querySelectorAll: () => lines.map((line) => ({ textContent: line })),
    getAttribute: (name) => name === "font-size" ? "12" : null,
    getNumberOfChars: () => normalized.length,
    getStartPositionOfChar: (index) => {
      assert.ok(index < normalized.length, "Never request a raw whitespace index beyond the rendered SVG character count");
      positions.push(index); return { x: index * 8, y: 12 };
    },
    getRotationOfChar: () => 0,
    replaceWith() {},
  };
  outlineText(text, font, 1);
  assert.equal(positions.length, normalized.length);
  assert.equal(positions.at(-1), normalized.length - 1);
  positions.length = 0;
  text.getNumberOfChars = () => text.textContent.length;
  text.getStartPositionOfChar = (index) => { positions.push(index); return { x: index, y: 12 }; };
  outlineText(text, font, 1);
  assert.equal(positions.length, text.textContent.length, "Preserved SVG whitespace must not be removed");
} finally {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
}
console.log("PSD: Bezier conversion, real font outlines, layered write/read and visibility passed.");
