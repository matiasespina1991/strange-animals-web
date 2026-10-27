import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const compiled = ts.transpileModule(readFileSync("src/features/identity/canvas-hole-mask.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { canvasHoleMask } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const decode = mask => decodeURIComponent(mask.slice('url("data:image/svg+xml,'.length, -2));
const svg = decode(canvasHoleMask(10, 300));
assert.match(svg, /viewBox="0 0 600 600"/);
assert.match(svg, /fill-rule="evenodd"/);
assert.match(svg, /M290 300a10 10/);
assert.match(svg, /0 1 0 20 0a10 10 0 1 0 -20 0Z/);
assert.match(decode(canvasHoleMask(20, 300)), /M280 300a20 20/);
assert.match(decode(canvasHoleMask(10, 600)), /M295 300a5 5/);
for (const args of [[0, 300], [10, 0], [NaN, 300], [10, Infinity]]) assert.equal(canvasHoleMask(...args), undefined);
const source = readFileSync("src/features/identity/DesignConfiguratorEditor.tsx", "utf8");
assert.doesNotMatch(source, /\n\s+whiteCenter(?:\s|=)/);
assert.match(source, /maskImage: canvasHoleMask\(design.holeMm, sleeveCanvasSizeMm\)/);
assert.match(source, /WebkitMaskImage: canvasHoleMask\(design.holeMm, sleeveCanvasSizeMm\)/);
assert.match(source, /cutCenter=\{false\}/);
console.log("Canvas center hole: transparent cutout, physical dimensions, Safari support and sleeve-editing isolation passed.");
