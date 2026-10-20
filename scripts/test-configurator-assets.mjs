import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import ts from "typescript";

const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const root = new URL("../", import.meta.url);
const barcodeCode = compile(await readFile(new URL("src/features/identity/barcode-generator.ts", root), "utf8"))
  .replace('"jsbarcode"', JSON.stringify(import.meta.resolve("jsbarcode")));
const { drawBarcode, BARCODE_FORMATS } = await import(moduleUrl(barcodeCode));
for (const format of BARCODE_FORMATS) {
  const encoded = {};
  drawBarcode(encoded, format.example, format.value);
  assert.ok(encoded.encodings.length > 0, `${format.value} must generate bars`);
  assert.ok(encoded.encodings.some((item) => /1/.test(item.data)));
  assert.equal(encoded.encodings[0].options.background, "#ffffff");
  assert.equal(encoded.encodings[0].options.margin, 40, "Keep quiet zones");
}
assert.throws(() => drawBarcode({}, "", "EAN13"), /Enter a barcode/);
assert.throws(() => drawBarcode({}, "abc", "EAN13"), /Invalid/);
assert.throws(() => drawBarcode({}, "5901234123458", "EAN13"), /Invalid/, "Bad check digit must fail");
assert.throws(() => drawBarcode({}, "036000291453", "UPC"), /Invalid/);
assert.throws(() => drawBarcode({}, "x".repeat(81), "CODE128"), /80/);
const hiddenLabel = {};
drawBarcode(hiddenLabel, "SA-001", "CODE128", { displayValue: false });
assert.equal(hiddenLabel.encodings[0].options.displayValue, false);
const tallBarcode = {};
drawBarcode(tallBarcode, "SA-001", "CODE128", { height: 320 });
assert.equal(tallBarcode.encodings[0].options.height, 320);
assert.throws(() => drawBarcode({}, "SA-001", "CODE128", { height: 401 }), /height/);
assert.throws(() => drawBarcode({}, "SA-001", "CODE128", { height: NaN }), /height/);
const coloredBarcode = {};
drawBarcode(coloredBarcode, "SA-001", "CODE128", { lineColor: "#1A2925", background: "#F2C7D5" });
assert.equal(coloredBarcode.encodings[0].options.lineColor, "#1A2925");
assert.equal(coloredBarcode.encodings[0].options.background, "#F2C7D5");
assert.throws(() => drawBarcode({}, "SA-001", "CODE128", { lineColor: "invalid" }), /hex/);

const assets = await import(moduleUrl(compile(await readFile(new URL("src/features/identity/asset-library.ts", root), "utf8"))));
for (const asset of assets.BRAND_ASSETS) await access(new URL(`public${asset.url}`, root));
assert.equal(new Set(assets.BRAND_ASSETS.map((asset) => asset.id)).size, assets.BRAND_ASSETS.length);

const model = await import(moduleUrl(compile(await readFile(new URL("src/features/identity/design-configurator-model.ts", root), "utf8"))));
const original = structuredClone(model.initialDesign);
const image = { ...model.makeLayer("image", "asset-test"), image: "data:image/png;base64,aGVsbG8=", imageRatio: 5.5, width: 180, borderRadius: 12 };
const state = { past: [], present: original, future: [] };
const inserted = model.designReducer(state, { type: "change", change: (design) => ({ ...design, B: [...design.B, image] }) });
assert.strictEqual(inserted.present.A, original.A, "Asset insertion must not touch the other side");
assert.equal(inserted.present.B.at(-1).kind, "image");
const restored = model.parseDesign(JSON.parse(JSON.stringify(inserted.present)));
assert.equal(restored.B.at(-1).image, image.image);
assert.equal(restored.B.at(-1).imageRatio, image.imageRatio);
assert.equal(restored.B.at(-1).borderRadius, 12);
assert.equal(model.parseDesign({ ...original, A: original.A.map((layer) => ({ ...layer, borderRadius: 999 })) }).A[0].borderRadius, 100);
assert.equal(model.designReducer(inserted, { type: "undo" }).present.B.length, original.B.length);
assert.equal(model.designReducer(model.designReducer(inserted, { type: "undo" }), { type: "redo" }).present.B.length, original.B.length + 1);
console.log("Assets: catalog paths, barcode formats/validation, quiet zones, side isolation, persistence and undo/redo passed.");
