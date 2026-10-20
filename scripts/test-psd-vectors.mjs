import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import opentype from "opentype.js";
import { readPsd, writePsd } from "ag-psd";

const code = ts.transpileModule(await readFile(new URL("../src/features/identity/psd-vector-paths.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { psdPaths } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
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
const outlineSource = ts.transpileModule(await readFile(new URL("../src/features/identity/psd-text-outlines.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace('"opentype.js"', JSON.stringify(`data:text/javascript;base64,${Buffer.from(`import opentype from ${JSON.stringify(import.meta.resolve("opentype.js"))}; export const parse=opentype.parse;`).toString("base64")}`))
  .replace('"./psd-vector-paths"', JSON.stringify(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`));
const { embeddedOutlineFonts } = await import(`data:text/javascript;base64,${Buffer.from(outlineSource).toString("base64")}`);
const decodedFonts = embeddedOutlineFonts({ querySelector: () => ({ textContent: `@font-face{font-family:"Fixture";src:url(data:font/otf;base64,${fontBytes.toString("base64")}) format('opentype');}` }) });
assert.equal(decodedFonts.size, 1, "Decode embedded font bytes instead of relying on locally installed fonts");
console.log("PSD: Bezier conversion, real font outlines, layered write/read and visibility passed.");
