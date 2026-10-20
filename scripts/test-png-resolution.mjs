import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { crc32 } from "node:zlib";
import ts from "typescript";

const code = ts.transpileModule(await readFile(new URL("../src/features/identity/png-resolution.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { setPngResolution } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const original = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=", "base64");
const output = setPngResolution(original, 600);
assert.equal(output.length, original.length + 21);
const view = new DataView(output.buffer);
assert.equal(String.fromCharCode(...output.slice(37, 41)), "pHYs");
assert.equal(view.getUint32(41), 23622);
assert.equal(view.getUint32(45), 23622);
assert.equal(output[49], 1);
assert.equal(view.getUint32(50), crc32(output.subarray(37, 50)), "PNG density chunk must have a valid CRC");
assert.deepEqual(output.slice(0, 33), new Uint8Array(original.slice(0, 33)), "Preserve dimensions and alpha format");
assert.deepEqual(output.slice(54), new Uint8Array(original.slice(33)), "Preserve compressed image data exactly");
assert.deepEqual(setPngResolution(output, 600), output, "Replace old metadata without duplicate chunks");
assert.throws(() => setPngResolution(new Uint8Array(8), 600), /signature/);
console.log("PNG: 600 PPI density, valid CRC, unchanged image/alpha data and metadata replacement passed.");
