import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/features/identity/font-preview-text.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { getFontPreviewText } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
assert.equal(getFontPreviewText({ name: "Family" }), "Family");
assert.equal(getFontPreviewText({ name: "Family", previewString: "" }), "Family");
assert.equal(getFontPreviewText({ name: "Family", previewString: "  " }), "Family");
assert.equal(getFontPreviewText({ name: "Family", previewString: "あいうえお" }), "あいうえお");
assert.equal(getFontPreviewText({ name: "Family", previewString: "あいうえお" }, "Demo"), "Demo");
const page = await readFile(new URL("../src/features/identity/IdentityFontsPage.tsx", import.meta.url), "utf8");
assert.ok(!page.includes("NON_LATIN_SPECIMENS"));
assert.ok(!page.includes("getDefaultSpecimen"));
assert.ok(!page.includes("getSupportedPreviewText"), "Do not discard characters based on cmap coverage");
assert.ok(!page.includes("SupportedPreviewText"), "Render the selected text directly, including symbol-encoded fonts");
for (const demo of ["CALLUM callum", "fff", "FFF", "FfF", "漢字 あいう", "☀ ★", "  ", "first\nsecond"]) {
  assert.equal(getFontPreviewText({ name: "Flak", previewString: "あいうえお" }, demo), demo);
}
console.log("Font preview: Demo text > stored previewString > family name; no hardcoded family overrides.");
