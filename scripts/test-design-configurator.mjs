import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
  new URL(
    "../src/features/identity/design-configurator-model.ts",
    import.meta.url,
  ),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const {
  initialDesign,
  parseDesign,
  designReducer,
  makeLayer,
  circularPath,
  safeFilename,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const original = structuredClone(initialDesign);
const colorSource = await readFile(new URL("../src/features/identity/text-color-model.ts", import.meta.url), "utf8");
const colorCode = ts.transpileModule(colorSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { hasCustomTextColors, changeLayerTextColors, changeGlobalTextColor, swapTextAndLabelColors } = await import(`data:text/javascript;base64,${Buffer.from(colorCode).toString("base64")}`);
assert.equal(hasCustomTextColors(original), false);
const globalPink = changeGlobalTextColor(original, "#FA8AA6");
assert.equal(hasCustomTextColors(globalPink), false, "A global color must not count as a layer customization");
const globalGreen = changeGlobalTextColor(globalPink, "#1A2925");
assert.equal(hasCustomTextColors(globalGreen), false, "Repeated global palette changes must not require confirmation");
const customArtist = changeLayerTextColors(globalGreen, "A", new Set(["artist"]), "#FF1493");
const sidePink = changeGlobalTextColor(customArtist, "#FA8AA6", "A");
assert.strictEqual(sidePink.B, customArtist.B, "Changing side A text must preserve side B");
assert.equal(hasCustomTextColors(sidePink, "A"), false);
assert.equal(hasCustomTextColors(customArtist, "B"), false, "Custom colors on A must not trigger a warning on B");
const sideSwap = swapTextAndLabelColors(globalGreen, "A");
assert.strictEqual(sideSwap.B, globalGreen.B, "Swapping on A must not recolor B text");
assert.equal(hasCustomTextColors(customArtist), true);
assert.equal(customArtist.A.find((layer) => layer.id === "artist").customTextColor, true);
assert.equal(customArtist.B.find((layer) => layer.id === "artist").customTextColor, false);
assert.equal(hasCustomTextColors(parseDesign(JSON.parse(JSON.stringify(customArtist)))) , true, "Manual color provenance must survive project save/import");
const unified = changeGlobalTextColor(customArtist, "#ffffff");
assert.equal(hasCustomTextColors(unified), false, "Confirming global color clears layer overrides");
assert.ok([...unified.A, ...unified.B].filter((layer) => layer.kind !== "image").every((layer) => layer.color === "#ffffff"));
assert.equal(hasCustomTextColors(changeLayerTextColors(unified, "A", new Set(["artist"]), "#FFFFFF")), false, "Selecting the same color is not a customization");
assert.equal(hasCustomTextColors(changeLayerTextColors(unified, "B", new Set(["tracks"]), "#592C63")), true, "A new individual edit must require confirmation again");
assert.equal(hasCustomTextColors(parseDesign({ ...original, A: original.A.map((layer) => ({ ...layer, color: "#123456", customTextColor: undefined })) })), false, "Do not infer manual edits from a non-default color");
const customHistory = { past: [], present: customArtist, future: [] };
const changedHistory = designReducer(customHistory, { type: "change", change: (design) => changeGlobalTextColor(design, "#ffffff") });
assert.equal(hasCustomTextColors(designReducer(changedHistory, { type: "undo" }).present), true, "Undo must restore manual color provenance");
const swapped = swapTextAndLabelColors(globalGreen);
assert.equal(swapped.paper, "#1A2925");
assert.ok([...swapped.A, ...swapped.B].every((layer) => layer.kind === "image" || layer.color === globalGreen.paper));
assert.equal(swapped.sleeveColor, globalGreen.sleeveColor);
assert.equal(swapTextAndLabelColors(customArtist), customArtist, "Mixed text colors cannot be swapped ambiguously");
assert.equal(parseDesign({ ...original, frame: undefined }).frame, false);
assert.equal(parseDesign({ ...original, frame: true }).frame, true, "Existing projects must retain an enabled border");
const lineHeightDesign = structuredClone(original);
lineHeightDesign.A.find((layer) => layer.id === "title").lineHeight = 1.75;
assert.equal(parseDesign(JSON.parse(JSON.stringify(lineHeightDesign))).A.find((layer) => layer.id === "title").lineHeight, 1.75);
assert.equal(parseDesign({ ...original, A: original.A.map((layer) => ({ ...layer, lineHeight: undefined })) }).A[0].lineHeight, 1.1);
assert.equal(parseDesign({ ...original, A: original.A.map((layer) => ({ ...layer, lineHeight: 99 })) }).A[0].lineHeight, 3);
const jsxModule = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  .replaceAll('"react"', JSON.stringify(import.meta.resolve("react")))
  .replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")));
const asModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const guideModule = asModule(jsxModule(await readFile(new URL("../src/features/identity/TextSelectionGuide.tsx", import.meta.url), "utf8")));
const inkModule = asModule(jsxModule(await readFile(new URL("../src/features/identity/InkBleedFilter.tsx", import.meta.url), "utf8")));
const artworkCode = jsxModule(await readFile(new URL("../src/features/identity/LabelArtwork.tsx", import.meta.url), "utf8"))
  .replace('"./design-configurator-model"', JSON.stringify(asModule(compiled)))
  .replace('"./TextSelectionGuide"', JSON.stringify(guideModule))
  .replace('"./InkBleedFilter"', JSON.stringify(inkModule));
const { LabelArtwork } = await import(asModule(artworkCode));
const { renderToStaticMarkup } = await import("react-dom/server");
const artworkProps = { design: lineHeightDesign, side: "A", prefix: "test", fontFamily: () => "Arial" };
const exportedSvg = renderToStaticMarkup(LabelArtwork(artworkProps));
const selectedImages = [makeLayer("image", "selection-1"), makeLayer("image", "selection-2"), makeLayer("image", "unselected")];
const multiGuidesSvg = renderToStaticMarkup(LabelArtwork({ ...artworkProps, design: { ...lineHeightDesign, A: selectedImages }, guides: true, selectedIds: new Set(["selection-1", "selection-2"]) }));
assert.equal((multiGuidesSvg.match(/class="dc-selection-guide"/g) ?? []).length, 2, "Each selected layer must have a guide");
const operations = await import(asModule(jsxModule(await readFile(new URL("../src/features/identity/layer-operations.ts", import.meta.url), "utf8"))));
const selectedIds = new Set(original.A.slice(0, 2).map((layer) => layer.id));
const deleted = designReducer({ past: [], present: original, future: [] }, { type: "change", change: (design) => operations.removeLayers(design, "A", selectedIds) });
assert.equal(deleted.present.A.length, original.A.length - 2);
assert.strictEqual(deleted.present.B, original.B);
assert.deepEqual(designReducer(deleted, { type: "undo" }).present, original, "One undo must restore all deleted layers");
const deleteAll = operations.removeLayers(original, "A", new Set(original.A.map((layer) => layer.id)));
assert.deepEqual(parseDesign(JSON.parse(JSON.stringify(deleteAll))).A, []);
const roundedLayer = { ...makeLayer("image", "rounded-test"), image: "data:image/png;base64,aGVsbG8=", borderRadius: 12 };
const roundedSvg = renderToStaticMarkup(LabelArtwork({ ...artworkProps, design: { ...lineHeightDesign, A: [roundedLayer] } }));
assert.ok(roundedSvg.includes('rx="12"'));
assert.ok(roundedSvg.includes('clip-path="url(#test-image-corners-0)"'));
assert.equal(parseDesign(original).A[0].inkBleed, 0);
assert.equal(parseDesign({ ...original, A: original.A.map((layer) => ({ ...layer, inkBleed: 99 })) }).A[0].inkBleed, 8);
assert.equal(parseDesign({ ...original, A: original.A.map((layer) => ({ ...layer, inkBleed: 6 })) }).A[0].inkBleed, 6);
assert.equal(parseDesign({ ...original, A: original.A.map((layer) => ({ ...layer, lineHeight: 0 })) }).A[0].lineHeight, 0);
const inkDesign = { ...lineHeightDesign, A: lineHeightDesign.A.map((layer, index) => index === 0 ? { ...layer, inkBleed: 0.75 } : layer) };
assert.equal(parseDesign(JSON.parse(JSON.stringify(inkDesign))).A[0].inkBleed, 0.75);
assert.equal(parseDesign(inkDesign).A[1].inkBleed, 0);
const inkSvg = renderToStaticMarkup(LabelArtwork({ ...artworkProps, design: inkDesign }));
assert.ok(inkSvg.includes('stdDeviation="0.75"'));
assert.equal((inkSvg.match(/filter="url\(#test-ink-bleed-/g) ?? []).length, 1, "Ink bleed must affect only its own layer");
assert.ok(inkSvg.includes('type="linear" slope="12" intercept="-2.5"'), "Ink bleed must have a subtly softened alpha transition");
assert.ok(!inkSvg.includes('type="discrete"'), "Ink bleed must not clip the edge with a hard alpha threshold");
assert.ok(!exportedSvg.includes('test-ink-bleed'), "Disabled ink bleed must not render a filter");
assert.ok(exportedSvg.includes('dy="1.75em"'), "Exported SVG must use the selected line height");
assert.ok(!exportedSvg.includes("dc-label-shadow"), "Preview shadows must not export");
assert.ok(!/<circle[^>]+fill="#ffffff"/.test(exportedSvg), "Print hole must remain transparent");
const previewSvg = renderToStaticMarkup(LabelArtwork({ ...artworkProps, previewShadow: true, whiteCenter: true }));
assert.ok(previewSvg.includes("dc-label-shadow"));
assert.match(previewSvg, /<circle[^>]+fill="#ffffff"/, "Preview center must stay white");
assert.equal(parseDesign({ ...original, sleeveZoom: undefined }).sleeveZoom, 1);
assert.equal(parseDesign({ ...original, sleeveZoom: 99 }).sleeveZoom, 3);
assert.equal(parseDesign({ ...original, sleeveImage: "data:image/png;base64,aGVsbG8=" }).sleeveImage, "data:image/png;base64,aGVsbG8=");
assert.throws(() => parseDesign({ ...original, sleeveImage: "https://example.com/image.png" }));
assert.throws(() => parseDesign({ ...original, sleeveImage: "data:image/svg+xml;base64,PHN2Zz4=" }));
const templateSource = await readFile(new URL("../src/features/identity/label-templates.ts", import.meta.url), "utf8");
const templateCode = ts.transpileModule(templateSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace('"./design-configurator-model"', JSON.stringify(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`));
const { LABEL_TEMPLATES } = await import(`data:text/javascript;base64,${Buffer.from(templateCode).toString("base64")}`);
assert.equal(LABEL_TEMPLATES.length, 6);
assert.equal(new Set(LABEL_TEMPLATES.map((template) => template.id)).size, 6);
for (const template of LABEL_TEMPLATES) {
  const parsed = parseDesign(template.design);
  assert.ok(parsed.A.length && parsed.B.length, `${template.name} must contain both sides`);
  assert.ok(parsed.A.some((layer) => layer.id === "title" && layer.visible));
}
assert.deepEqual(initialDesign, original, "Templates must not mutate the default design");
let history = { past: [], present: original, future: [] };
const rename = (title) => (current) => ({ ...current, title });
history = designReducer(history, {
  type: "change",
  change: rename("First"),
  group: "title",
});
history = designReducer(history, {
  type: "change",
  change: rename("Second"),
  group: "title",
});
assert.equal(
  history.past.length,
  1,
  "A grouped edit must create one undo step",
);
history = designReducer(history, { type: "undo" });
assert.equal(history.present.title, original.title);
history = designReducer(history, { type: "redo" });
assert.equal(history.present.title, "Second");
history = designReducer(history, { type: "end" });
history = designReducer(history, { type: "change", change: rename("Third") });
assert.equal(history.past.length, 2);
history = designReducer(history, { type: "undo" });
history = designReducer(history, {
  type: "change",
  change: rename("New branch"),
});
assert.equal(history.future.length, 0);
const same = designReducer(history, {
  type: "change",
  change: (c) => ({ ...c }),
});
assert.equal(same, history, "No-op edits must not consume history");
assert.deepEqual(
  parseDesign(JSON.parse(JSON.stringify(original))),
  parseDesign(original),
);
const circular = makeLayer("circular", "test");
assert.equal(
  circularPath(circular),
  circularPath({ ...circular, size: 125 }),
  "Font size must never change the path",
);
assert.notEqual(
  circularPath(circular),
  circularPath({ ...circular, arc: "top" }),
);
assert.equal(
  (circularPath(circular).match(/ A /g) ?? []).length,
  2,
  "Circular text must have a complete circumference made of two semicircles",
);
const legacy = {
  A: [{ id: "legal", text: "Legacy", size: 11 }],
  B: [{ id: "title", text: "Title" }],
  paper: "#ffffff",
};
assert.equal(parseDesign(legacy).A[0].kind, "circular");
assert.equal(
  parseDesign({ ...original, diameterMm: 999, holeMm: 999 }).diameterMm,
  150,
);
assert.throws(
  () => parseDesign({ ...original, A: [original.A[0], original.A[0]] }),
  /duplicados/,
);
assert.throws(() => parseDesign({ ...original, version: 9 }), /Versión/);
assert.deepEqual(parseDesign({ ...original, A: [] }).A, [], "An empty side must survive saving after deleting all layers");
assert.throws(
  () =>
    parseDesign({
      ...original,
      A: [
        {
          ...makeLayer("image", "unsafe"),
          image: "data:image/svg+xml;base64,PHN2Zz4=",
        },
      ],
    }),
  /Imagen inválida/,
);
assert.equal(safeFilename("../../Label <script>"), "Label-script");
assert.equal(original.A.length, 9);
assert.equal(original.B.find((l) => l.id === "side").text, "B");
console.log(
  "Design configurator: history, grouping, import validation, migration, circular geometry and filenames passed.",
);
