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
  getSurfaceLayers,
  updateSurfaceLayers,
  sleeveLabelGeometry,
  initialImageLayerPosition,
  designReducer,
  makeLayer,
  circularPath,
  cylinderTextSegments,
  cylinderTextSpan,
  splitTextGraphemes,
  safeFilename,
  extrusionOpacity,
  extrusionBlurBands,
  textExtrusion,
  cylinderExtrusionSteps,
  circularCylinderSlices,
  cylinderTextLayout,
  closedCylinderText,
  cylinderBackBlurBands,
  cylinderShading,
  cylinderOpacity,
  imageCropBounds,
  imageRole,
  barcodeSourceMatrix,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const original = structuredClone(initialDesign);
const colorSource = await readFile(
  new URL("../src/features/identity/text-color-model.ts", import.meta.url),
  "utf8",
);
const colorSourceWithLocalHelpers = colorSource.replace(
  /^import \{ getSurfaceLayers, updateSurfaceLayers, type LabelDesign, type LabelSide, type LabelSurface \} from "\.\/design-configurator-model";\r?\n/m,
  "",
);
const colorCode = `${compiled}\n${
  ts.transpileModule(colorSourceWithLocalHelpers, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
}`;
const {
  hasCustomTextColors,
  changeLayerTextColors,
  changeGlobalTextColor,
  swapTextAndLabelColors,
} = await import(
  `data:text/javascript;base64,${Buffer.from(colorCode).toString("base64")}`
);
assert.equal(hasCustomTextColors(original), false);
const globalPink = changeGlobalTextColor(original, "#FA8AA6");
assert.equal(
  hasCustomTextColors(globalPink),
  false,
  "A global color must not count as a layer customization",
);
const globalGreen = changeGlobalTextColor(globalPink, "#1A2925");
assert.equal(
  hasCustomTextColors(globalGreen),
  false,
  "Repeated global palette changes must not require confirmation",
);
const sleeveText = makeLayer("text", "sleeve-artist");
const sleeveColorDesign = updateSurfaceLayers(original, "sleeve", "A", () => [
  sleeveText,
]);
const sleeveColorChanged = changeGlobalTextColor(
  sleeveColorDesign,
  "#FA8AA6",
  "A",
  "sleeve",
);
assert.equal(sleeveColorChanged.sleeveA[0].color, "#FA8AA6");
assert.strictEqual(sleeveColorChanged.A, original.A);
assert.strictEqual(sleeveColorChanged.B, original.B);
assert.strictEqual(sleeveColorChanged.sleeveB, original.sleeveB);
const customArtist = changeLayerTextColors(
  globalGreen,
  "A",
  new Set(["artist"]),
  "#FF1493",
);
const sidePink = changeGlobalTextColor(customArtist, "#FA8AA6", "A");
assert.strictEqual(
  sidePink.B,
  customArtist.B,
  "Changing side A text must preserve side B",
);
assert.equal(hasCustomTextColors(sidePink, "A"), false);
assert.equal(
  hasCustomTextColors(customArtist, "B"),
  false,
  "Custom colors on A must not trigger a warning on B",
);
const sideSwap = swapTextAndLabelColors(globalGreen, "A");
assert.strictEqual(
  sideSwap.B,
  globalGreen.B,
  "Swapping on A must not recolor B text",
);
assert.equal(hasCustomTextColors(customArtist), true);
assert.equal(
  customArtist.A.find((layer) => layer.id === "artist").customTextColor,
  true,
);
assert.equal(
  customArtist.B.find((layer) => layer.id === "artist").customTextColor,
  false,
);
assert.equal(
  hasCustomTextColors(parseDesign(JSON.parse(JSON.stringify(customArtist)))),
  true,
  "Manual color provenance must survive project save/import",
);
const unified = changeGlobalTextColor(customArtist, "#ffffff");
assert.equal(
  hasCustomTextColors(unified),
  false,
  "Confirming global color clears layer overrides",
);
assert.ok(
  [...unified.A, ...unified.B]
    .filter((layer) => layer.kind !== "image")
    .every((layer) => layer.color === "#ffffff"),
);
assert.equal(
  hasCustomTextColors(
    changeLayerTextColors(unified, "A", new Set(["artist"]), "#FFFFFF"),
  ),
  false,
  "Selecting the same color is not a customization",
);
assert.equal(
  hasCustomTextColors(
    changeLayerTextColors(unified, "B", new Set(["tracks"]), "#592C63"),
  ),
  true,
  "A new individual edit must require confirmation again",
);
assert.equal(
  hasCustomTextColors(
    parseDesign({
      ...original,
      A: original.A.map((layer) => ({
        ...layer,
        color: "#123456",
        customTextColor: undefined,
      })),
    }),
  ),
  false,
  "Do not infer manual edits from a non-default color",
);
const customHistory = { past: [], present: customArtist, future: [] };
const changedHistory = designReducer(customHistory, {
  type: "change",
  change: (design) => changeGlobalTextColor(design, "#ffffff"),
});
assert.equal(
  hasCustomTextColors(designReducer(changedHistory, { type: "undo" }).present),
  true,
  "Undo must restore manual color provenance",
);
const swapped = swapTextAndLabelColors(globalGreen);
assert.equal(swapped.paper, "#1A2925");
assert.ok(
  [...swapped.A, ...swapped.B].every(
    (layer) => layer.kind === "image" || layer.color === globalGreen.paper,
  ),
);
assert.equal(swapped.sleeveColor, globalGreen.sleeveColor);
assert.equal(
  swapTextAndLabelColors(customArtist),
  customArtist,
  "Mixed text colors cannot be swapped ambiguously",
);
assert.equal(parseDesign({ ...original, frame: undefined }).frame, false);
assert.equal(
  parseDesign({ ...original, frame: true }).frame,
  true,
  "Existing projects must retain an enabled border",
);
const lineHeightDesign = structuredClone(original);
lineHeightDesign.A.find((layer) => layer.id === "title").lineHeight = 1.75;
assert.equal(
  parseDesign(JSON.parse(JSON.stringify(lineHeightDesign))).A.find(
    (layer) => layer.id === "title",
  ).lineHeight,
  1.75,
);
assert.equal(
  parseDesign({
    ...original,
    A: original.A.map((layer) => ({ ...layer, lineHeight: undefined })),
  }).A[0].lineHeight,
  1.1,
);
assert.equal(
  parseDesign({
    ...original,
    A: original.A.map((layer) => ({ ...layer, lineHeight: 99 })),
  }).A[0].lineHeight,
  3,
);
const jsxModule = (source) =>
  ts
    .transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    })
    .outputText.replaceAll(
      '"react"',
      JSON.stringify(import.meta.resolve("react")),
    )
    .replaceAll(
      '"react/jsx-runtime"',
      JSON.stringify(import.meta.resolve("react/jsx-runtime")),
    );
const asModule = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const guideModule = asModule(
  jsxModule(
    await readFile(
      new URL(
        "../src/features/identity/TextSelectionGuide.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const inkModule = asModule(
  jsxModule(
    await readFile(
      new URL("../src/features/identity/InkBleedFilter.tsx", import.meta.url),
      "utf8",
    ),
  ),
);
const artworkCode = jsxModule(
  await readFile(
    new URL("../src/features/identity/LabelArtwork.tsx", import.meta.url),
    "utf8",
  ),
)
  .replace('"./design-configurator-model"', JSON.stringify(asModule(compiled)))
  .replace('"./TextSelectionGuide"', JSON.stringify(guideModule))
  .replace('"./InkBleedFilter"', JSON.stringify(inkModule));
const { LabelArtwork } = await import(asModule(artworkCode));
const { renderToStaticMarkup } = await import("react-dom/server");
const artworkProps = {
  design: lineHeightDesign,
  side: "A",
  prefix: "test",
  fontFamily: () => "Arial",
};
const exportedSvg = renderToStaticMarkup(LabelArtwork(artworkProps));
const differenceLayer = {
  ...makeLayer("text", "difference-preview"),
  text: "READABLE",
  blendMode: "difference",
};
const differenceSvg = renderToStaticMarkup(
  LabelArtwork({
    ...artworkProps,
    design: { ...original, A: [differenceLayer] },
  }),
);
assert.ok(differenceSvg.includes('style="mix-blend-mode:difference"'));
assert.ok(differenceSvg.includes('fill="#ffffff"'));
assert.ok(!exportedSvg.includes("mix-blend-mode:difference"));
const textureData = "data:image/png;base64,aGVsbG8=";
const texturedLayer = {
  ...makeLayer("text", "textured"),
  text: "TEXTURE",
  textTexture: textureData,
  textTextureOpacity: 0.4,
  textTextureScale: 175,
};
const texturedDesign = { ...original, A: [texturedLayer] };
const restoredTexture = parseDesign(JSON.parse(JSON.stringify(texturedDesign)))
  .A[0];
assert.equal(restoredTexture.textTexture, textureData);
assert.equal(restoredTexture.textTextureOpacity, 0.4);
assert.equal(restoredTexture.textTextureScale, 175);
const texturedSvg = renderToStaticMarkup(
  LabelArtwork({ ...artworkProps, design: texturedDesign }),
);
assert.match(
  texturedSvg,
  /<pattern[^>]*id="test-text-surface-0"[^>]*width="1050" height="1050"/,
);
assert.match(texturedSvg, /<image[^>]*opacity="0\.4"/);
assert.match(texturedSvg, /<text[^>]*fill="url\(#test-text-surface-0\)"/);
const texturedDifferenceSvg = renderToStaticMarkup(
  LabelArtwork({
    ...artworkProps,
    design: { ...original, A: [{ ...texturedLayer, blendMode: "difference" }] },
  }),
);
assert.match(
  texturedDifferenceSvg,
  /<text[^>]*fill="url\(#test-text-surface-0\)"[^>]*style="mix-blend-mode:difference"/,
);
assert.throws(
  () =>
    parseDesign({
      ...original,
      A: [
        { ...texturedLayer, textTexture: "data:image/svg+xml;base64,PHN2Zy8+" },
      ],
    }),
  /Textura inválida/,
);
assert.equal(
  parseDesign({ ...original, A: [{ ...texturedLayer, textTextureScale: 999 }] })
    .A[0].textTextureScale,
  400,
);
for (const kind of ["text", "circular"]) {
  const threeDimensional = {
    ...texturedLayer,
    kind,
    textEffect: {
      type: "cylinder",
      radius: 170,
      span: 150,
      segments: 12,
      extrusion: { depth: 20, angle: 45, steps: 2 },
    },
  };
  const threeDimensionalSvg = renderToStaticMarkup(
    LabelArtwork({
      ...artworkProps,
      design: { ...original, A: [threeDimensional] },
    }),
  );
  assert.ok(
    (threeDimensionalSvg.match(/fill="url\(#test-text-surface-0\)"/g) ?? [])
      .length > 1,
    `${kind} cylinder extrusion must retain its image surface`,
  );
  assert.ok(
    (threeDimensionalSvg.match(/brightness\(/g) ?? []).length > 1,
    `${kind} cylinder extrusion must shade its image surface`,
  );
}
const selectedImages = [
  makeLayer("image", "selection-1"),
  makeLayer("image", "selection-2"),
  makeLayer("image", "unselected"),
];
const multiGuidesSvg = renderToStaticMarkup(
  LabelArtwork({
    ...artworkProps,
    design: { ...lineHeightDesign, A: selectedImages },
    guides: true,
    selectedIds: new Set(["selection-1", "selection-2"]),
  }),
);
assert.equal(
  (multiGuidesSvg.match(/class="dc-selection-guide"/g) ?? []).length,
  2,
  "Each selected layer must have a guide",
);
const operationsSource = await readFile(
  new URL("../src/features/identity/layer-operations.ts", import.meta.url),
  "utf8",
);
const operationsWithoutModelImport = operationsSource.replace(
  /^import \{ updateSurfaceLayers, type LabelDesign, type LabelSide, type LabelSurface \} from "\.\/design-configurator-model";\r?\n/m,
  "",
);
const operationsCode = `${compiled}\n${
  ts.transpileModule(operationsWithoutModelImport, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
}`;
const operations = await import(asModule(operationsCode));
const selectedIds = new Set(original.A.slice(0, 2).map((layer) => layer.id));
const deleted = designReducer(
  { past: [], present: original, future: [] },
  {
    type: "change",
    change: (design) =>
      operations.removeLayers(design, "A", "cookie", selectedIds),
  },
);
assert.equal(deleted.present.A.length, original.A.length - 2);
assert.strictEqual(deleted.present.B, original.B);
assert.deepEqual(
  designReducer(deleted, { type: "undo" }).present,
  original,
  "One undo must restore all deleted layers",
);
const deleteAll = operations.removeLayers(
  original,
  "A",
  "cookie",
  new Set(original.A.map((layer) => layer.id)),
);
assert.deepEqual(parseDesign(JSON.parse(JSON.stringify(deleteAll))).A, []);
const sleeveDeleteSource = updateSurfaceLayers(original, "sleeve", "A", () => [
  makeLayer("text", "sleeve-delete"),
]);
const sleeveDelete = operations.removeLayers(
  sleeveDeleteSource,
  "A",
  "sleeve",
  new Set(["sleeve-delete"]),
);
assert.deepEqual(sleeveDelete.sleeveA, []);
assert.strictEqual(sleeveDelete.A, original.A);
const roundedLayer = {
  ...makeLayer("image", "rounded-test"),
  image: "data:image/png;base64,aGVsbG8=",
  borderRadius: 12,
};
const roundedSvg = renderToStaticMarkup(
  LabelArtwork({
    ...artworkProps,
    design: { ...lineHeightDesign, A: [roundedLayer] },
  }),
);
assert.ok(roundedSvg.includes('rx="12"'));
assert.ok(
  roundedSvg.includes('clip-path="url(#test-image-crop-rounded-test)"'),
);
assert.equal(parseDesign(original).A[0].inkBleed, 0);
assert.equal(
  parseDesign({
    ...original,
    A: original.A.map((layer) => ({ ...layer, inkBleed: 99 })),
  }).A[0].inkBleed,
  8,
);
assert.equal(
  parseDesign({
    ...original,
    A: original.A.map((layer) => ({ ...layer, inkBleed: 6 })),
  }).A[0].inkBleed,
  6,
);
assert.equal(
  parseDesign({
    ...original,
    A: original.A.map((layer) => ({ ...layer, lineHeight: 0 })),
  }).A[0].lineHeight,
  0,
);
const inkDesign = {
  ...lineHeightDesign,
  A: lineHeightDesign.A.map((layer, index) =>
    index === 0 ? { ...layer, inkBleed: 0.75 } : layer,
  ),
};
assert.equal(
  parseDesign(JSON.parse(JSON.stringify(inkDesign))).A[0].inkBleed,
  0.75,
);
assert.equal(parseDesign(inkDesign).A[1].inkBleed, 0);
const inkSvg = renderToStaticMarkup(
  LabelArtwork({ ...artworkProps, design: inkDesign }),
);
assert.ok(inkSvg.includes('stdDeviation="0.75"'));
assert.equal(
  (inkSvg.match(/filter="url\(#test-ink-bleed-/g) ?? []).length,
  1,
  "Ink bleed must affect only its own layer",
);
assert.ok(
  inkSvg.includes('type="linear" slope="12" intercept="-2.5"'),
  "Ink bleed must have a subtly softened alpha transition",
);
assert.ok(
  !inkSvg.includes('type="discrete"'),
  "Ink bleed must not clip the edge with a hard alpha threshold",
);
assert.ok(
  !exportedSvg.includes("test-ink-bleed"),
  "Disabled ink bleed must not render a filter",
);
assert.ok(
  exportedSvg.includes('dy="1.75em"'),
  "Exported SVG must use the selected line height",
);
assert.ok(
  !exportedSvg.includes("cookie-inner-shadow"),
  "Preview inset shadows must not export",
);
assert.ok(
  !/<circle[^>]+fill="#ffffff"/.test(exportedSvg),
  "Print hole must remain transparent",
);
const previewSvg = renderToStaticMarkup(
  LabelArtwork({ ...artworkProps, whiteCenter: true, innerShadow: true }),
);
assert.doesNotMatch(exportedSvg, /<circle[^>]+fill="black"/);
assert.match(exportedSvg, /clip-rule="evenodd"/);
const parentCutoutSvg = renderToStaticMarkup(LabelArtwork({ ...artworkProps, cutCenter: false, guides: true }));
assert.doesNotMatch(parentCutoutSvg, /fill="black"|test-hole|clip-rule="evenodd"/);
assert.match(parentCutoutSvg, /<clipPath id="test-trim"><circle/);
assert.ok(previewSvg.includes("cookie-inner-shadow"));
const previewStyles = await readFile(
  new URL("../src/features/identity/design-configurator.css", import.meta.url),
  "utf8",
);
assert.match(
  previewStyles,
  /\.dc-artboard \.dc-disc\s*\{\s*filter: none;/,
  "The editor label must not cast an exterior shadow",
);
assert.match(
  previewSvg,
  /<circle[^>]+fill="#ffffff"/,
  "Preview center must stay white",
);
const extrudedText = {
  ...makeLayer("text", "extruded-test"),
  text: "STATIC",
  textEffect: { type: "extrusion", depth: 12, angle: 45, steps: 5 },
};
const extrudedSvg = renderToStaticMarkup(
  LabelArtwork({ ...artworkProps, design: { ...original, A: [extrudedText] } }),
);
assert.equal((extrudedSvg.match(/<text\b/g) ?? []).length, 6);
assert.ok(extrudedSvg.includes('aria-hidden="true"'));
assert.ok(!extrudedSvg.includes("animation"));
const cylinderText = {
  ...makeLayer("text", "cylinder-test"),
  text: "ABCD",
  textEffect: { type: "cylinder", radius: 170, span: 150, segments: 24 },
};
const cylinderSvg = renderToStaticMarkup(
  LabelArtwork({ ...artworkProps, design: { ...original, A: [cylinderText] } }),
);
assert.equal((cylinderSvg.match(/<text\b/g) ?? []).length, 4);
assert.match(cylinderSvg, /letter-spacing="0"/);
assert.doesNotMatch(
  cylinderSvg,
  /textLength=/,
  "Cylinder panels must not force-fit away tracking",
);
const trackedCylinderSvg = renderToStaticMarkup(
  LabelArtwork({
    ...artworkProps,
    design: { ...original, A: [{ ...cylinderText, spacing: 8 }] },
  }),
);
assert.match(trackedCylinderSvg, /letter-spacing="8"/);
assert.doesNotMatch(trackedCylinderSvg, /textLength=/);
assert.ok(!cylinderSvg.includes("animation"));
const tiltedCylinder = {
  ...cylinderText,
  textEffect: { ...cylinderText.textEffect, tilt: 35 },
};
const tiltedCylinderSvg = renderToStaticMarkup(
  LabelArtwork({
    ...artworkProps,
    design: { ...original, A: [tiltedCylinder] },
  }),
);
assert.notEqual(
  tiltedCylinderSvg,
  cylinderSvg,
  "Tilt must change exported SVG geometry",
);
assert.match(tiltedCylinderSvg, /matrix\(1 /);
const restoredTilt = parseDesign(
  JSON.parse(JSON.stringify({ ...original, A: [tiltedCylinder] })),
);
assert.equal(restoredTilt.A[0].textEffect.tilt, 35);
assert.equal(
  parseDesign({
    ...original,
    A: [
      {
        ...tiltedCylinder,
        textEffect: { ...tiltedCylinder.textEffect, tilt: 999 },
      },
    ],
  }).A[0].textEffect.tilt,
  75,
);
assert.equal(
  parseDesign({
    ...original,
    A: [
      {
        ...tiltedCylinder,
        textEffect: { ...tiltedCylinder.textEffect, tilt: -999 },
      },
    ],
  }).A[0].textEffect.tilt,
  -75,
);
assert.deepEqual(
  cylinderTextSegments(170, 150, 24),
  cylinderTextSegments(170, 150, 24, 0),
);
assert.deepEqual(
  cylinderTextSegments(170, 150, 24, 0),
  cylinderTextSegments(170, 150, 24, 0, 360),
);
assert.notDeepEqual(
  cylinderTextSegments(170, 150, 24, 0, 90),
  cylinderTextSegments(170, 150, 24, 0, 0),
  "Cylinder rotation changes segment projection",
);
assert.equal(
  parseDesign({
    ...original,
    A: [
      {
        ...tiltedCylinder,
        textEffect: { ...tiltedCylinder.textEffect, rotation: 999 },
      },
    ],
  }).A[0].textEffect.rotation,
  360,
);
const downSegments = cylinderTextSegments(170, 150, 24, 35);
const upSegments = cylinderTextSegments(170, 150, 24, -35);
assert.ok(
  downSegments[0].y > downSegments[11].y,
  "Downward tilt moves the deeper sides down",
);
for (let i = 0; i < downSegments.length; i++) {
  assert.ok(Math.abs(downSegments[i].y + upSegments[i].y) < 1e-9);
  assert.ok(Math.abs(downSegments[i].shear + upSegments[i].shear) < 1e-9);
}
for (const tilt of [-75, 0, 75]) {
  for (const segment of cylinderTextSegments(295, 180, 64, tilt)) {
    assert.ok(
      Object.values(segment).every(Number.isFinite),
      "Edge-on segments must stay finite",
    );
    assert.ok(segment.width > 0 && segment.verticalScale > 0);
  }
}
assert.equal(parseDesign({ ...original, sleeveZoom: undefined }).sleeveZoom, 1);
assert.equal(parseDesign({ ...original, sleeveZoom: 99 }).sleeveZoom, 5);
assert.equal(
  parseDesign({ ...original, sleeveImageOffsetX: undefined })
    .sleeveImageOffsetX,
  0,
);
assert.equal(
  parseDesign({ ...original, sleeveImageOffsetY: undefined })
    .sleeveImageOffsetY,
  0,
);
assert.equal(
  parseDesign({ ...original, sleeveImageOffsetX: -45, sleeveImageOffsetY: 80 })
    .sleeveImageOffsetX,
  -45,
);
assert.equal(
  parseDesign({ ...original, sleeveImageOffsetX: 900 }).sleeveImageOffsetX,
  600,
);
assert.deepEqual(
  parseDesign({ ...original, sleeveLayers: undefined }).sleeveLayers,
  [],
);
const sleeveLayer = {
  ...makeLayer("text", "sleeve-only"),
  text: "Sleeve lettering",
  fontId: "sleeve-font",
  variantId: "sleeve-variant",
};
const legacySleeveDesign = { ...original };
delete legacySleeveDesign.sleeveA;
delete legacySleeveDesign.sleeveB;
const sleeveDesign = parseDesign({
  ...legacySleeveDesign,
  sleeveLayers: [sleeveLayer],
});
assert.equal(sleeveDesign.sleeveA[0].id, "sleeve-only");
assert.equal(sleeveDesign.sleeveA[0].fontId, "sleeve-font");
assert.deepEqual(sleeveDesign.sleeveLayers, []);
assert.deepEqual(
  sleeveDesign.A.map((layer) => layer.id),
  original.A.map((layer) => layer.id),
);
assert.deepEqual(
  sleeveDesign.B.map((layer) => layer.id),
  original.B.map((layer) => layer.id),
);
assert.notEqual(sleeveDesign.A, sleeveDesign.B);
assert.deepEqual(sleeveDesign.sleeveB, []);
assert.equal(
  parseDesign({ ...original, sleeveB: [sleeveLayer] }).sleeveB[0].id,
  "sleeve-only",
);
const isolatedUpdate = updateSurfaceLayers(
  original,
  "sleeve",
  "A",
  (layers) => [...layers, sleeveLayer],
);
assert.deepEqual(getSurfaceLayers(isolatedUpdate, "sleeve", "A"), [
  sleeveLayer,
]);
assert.deepEqual(getSurfaceLayers(isolatedUpdate, "cookie", "A"), original.A);
assert.deepEqual(
  getSurfaceLayers(isolatedUpdate, "sleeve", "B"),
  original.sleeveB,
);
assert.deepEqual(getSurfaceLayers(isolatedUpdate, "cookie", "B"), original.B);
assert.deepEqual(sleeveLabelGeometry(100), {
  center: 300,
  radius: (100 / 315) * 300,
  radiusPercent: (((100 / 315) * 300) / 600) * 100,
});
assert.deepEqual(
  initialImageLayerPosition("cookie", { width: 180, imageRatio: 2 }),
  {
    x: 300,
    y: 300,
  },
);
assert.equal(
  initialImageLayerPosition("sleeve", { width: 180, imageRatio: 2 }).y,
  100,
);
assert.equal(initialImageLayerPosition("sleeve", { width: 150 }).y, 100);
assert.throws(() => parseDesign({ ...original, sleeveLayers: {} }));
assert.equal(
  parseDesign({ ...original, sleeveImage: "data:image/png;base64,aGVsbG8=" })
    .sleeveImage,
  "data:image/png;base64,aGVsbG8=",
);
assert.throws(() =>
  parseDesign({ ...original, sleeveImage: "https://example.com/image.png" }),
);
assert.throws(() =>
  parseDesign({
    ...original,
    sleeveImage: "data:image/svg+xml;base64,PHN2Zz4=",
  }),
);
const templateSource = await readFile(
  new URL("../src/features/identity/label-templates.ts", import.meta.url),
  "utf8",
);
const templateCode = ts
  .transpileModule(templateSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  })
  .outputText.replace(
    '"./design-configurator-model"',
    JSON.stringify(
      `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`,
    ),
  );
const { LABEL_TEMPLATES } = await import(
  `data:text/javascript;base64,${Buffer.from(templateCode).toString("base64")}`
);
assert.equal(LABEL_TEMPLATES.length, 6);
assert.equal(new Set(LABEL_TEMPLATES.map((template) => template.id)).size, 6);
for (const template of LABEL_TEMPLATES) {
  const parsed = parseDesign(template.design);
  assert.ok(
    parsed.A.length && parsed.B.length,
    `${template.name} must contain both sides`,
  );
  assert.ok(parsed.A.some((layer) => layer.id === "title" && layer.visible));
}
assert.deepEqual(
  initialDesign,
  original,
  "Templates must not mutate the default design",
);
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
const cylinderSegments = cylinderTextSegments(170, 150, 24);
assert.equal(cylinderSegments.length, 24);
assert.ok(Math.abs(cylinderSegments[0].x + cylinderSegments.at(-1).x) < 1e-9);
assert.ok(cylinderSegments[0].width < cylinderSegments[11].width);
assert.ok(cylinderSegments[0].scale < cylinderSegments[11].scale);
assert.equal(cylinderTextSegments(999, 999, 999).length, 64);
const shortTextSpan = cylinderTextSpan("A", 24, 0, 170, 150);
const longTextSpan = cylinderTextSpan("LONG LEGAL TEXT", 24, 0, 170, 150);
assert.ok(
  shortTextSpan < longTextSpan,
  "Short text must not be stretched across the full cylinder arc",
);
assert.equal(cylinderTextSpan("LONG LEGAL TEXT", 24, 0, 170, 40), 40);
assert.deepEqual(splitTextGraphemes("A\u0301👩‍🎨B"), ["A\u0301", "👩‍🎨", "B"]);
const effectDesign = parseDesign({
  ...original,
  A: [
    {
      ...makeLayer("text", "extruded"),
      textEffect: { type: "extrusion", depth: 999, angle: -20, steps: 999 },
    },
    {
      ...makeLayer("text", "cylindrical"),
      textEffect: { type: "cylinder", radius: 999, span: 999, segments: 99 },
    },
  ],
});
assert.deepEqual(effectDesign.A[0].textEffect, {
  type: "extrusion",
  depth: 400,
  angle: 0,
  steps: 200,
  fade: 0,
});
assert.deepEqual(effectDesign.A[1].textEffect, {
  type: "cylinder",
  radius: 295,
  span: 180,
  segments: 64,
  tilt: 0,
});
assert.deepEqual(
  parseDesign(JSON.parse(JSON.stringify(effectDesign))).A.map(
    (layer) => layer.textEffect,
  ),
  effectDesign.A.map((layer) => layer.textEffect),
  "Static text effects must survive project save/import",
);
assert.equal(
  parseDesign({
    ...original,
    A: [
      {
        ...makeLayer("image", "effect-image"),
        textEffect: effectDesign.A[0].textEffect,
      },
    ],
  }).A[0].textEffect,
  undefined,
  "Text effects must not be retained by image layers",
);
assert.deepEqual(
  parseDesign({
    ...original,
    A: [
      {
        ...makeLayer("circular", "effect-arc"),
        textEffect: effectDesign.A[0].textEffect,
      },
    ],
  }).A[0].textEffect,
  effectDesign.A[0].textEffect,
  "Arc text must retain its 3D effect when saved",
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
assert.deepEqual(
  parseDesign({ ...original, A: [] }).A,
  [],
  "An empty side must survive saving after deleting all layers",
);
const embeddedSvg = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
assert.equal(
  parseDesign({
    ...original,
    A: [{ ...makeLayer("image", "embedded-svg"), image: embeddedSvg }],
  }).A[0].image,
  embeddedSvg,
  "Sanitized SVG assets must survive project save/import",
);
assert.throws(
  () =>
    parseDesign({
      ...original,
      A: [
        {
          ...makeLayer("image", "unsafe-svg"),
          image: "data:image/svg+xml,<svg>",
        },
      ],
    }),
  /Imagen inválida/,
);
const differenceText = {
  ...makeLayer("text", "difference-text"),
  blendMode: "difference",
};
assert.equal(
  parseDesign({
    ...original,
    A: [differenceText],
  }).A[0].blendMode,
  "difference",
);
assert.equal(
  parseDesign({
    ...original,
    A: [{ ...differenceText, blendMode: "unknown" }],
  }).A[0].blendMode,
  undefined,
);
for (const unsafeSvg of [
  "<svg><script>alert(1)</script></svg>",
  '<svg onload="alert(1)"></svg>',
  '<svg><image href="https://example.com/image.png"/></svg>',
  '<svg><path style="fill:url(https://example.com/fill.svg#paint)"/></svg>',
]) {
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(unsafeSvg).toString("base64")}`;
  assert.throws(
    () =>
      parseDesign({
        ...original,
        A: [{ ...makeLayer("image", "unsafe-svg"), image: dataUri }],
      }),
    /Imagen inválida/,
    "Project imports must reject SVGs with active or external content",
  );
}
assert.equal(safeFilename("../../Label <script>"), "Label-script");
assert.equal(original.A.length, 9);
assert.equal(original.B.find((l) => l.id === "side").text, "B");
console.log(
  "Design configurator: history, grouping, import validation, migration, circular geometry and filenames passed.",
);

const combinedLayer = {
  ...makeLayer("text", "combined-test"),
  text: "TEST",
  size: 3000,
  textEffect: {
    type: "cylinder",
    radius: 170,
    span: 150,
    segments: 24,
    tilt: 20,
    rotation: 0,
    extrusion: { depth: 25, angle: 45, steps: 5, fade: 80 },
  },
};
const combinedDesign = parseDesign({ ...original, A: [combinedLayer] });
assert.equal(combinedDesign.A[0].size, 3000);
assert.equal(
  parseDesign({ ...original, A: [{ ...combinedLayer, size: 4000 }] }).A[0].size,
  3000,
);
assert.deepEqual(combinedDesign.A[0].textEffect, combinedLayer.textEffect);
assert.deepEqual(
  parseDesign(JSON.parse(JSON.stringify(combinedDesign))).A[0].textEffect,
  combinedLayer.textEffect,
);
assert.equal(extrusionOpacity(1, 5, 0), 1);
assert.equal(extrusionOpacity(5, 5, 100), 0);
assert.ok(extrusionOpacity(1, 5, 80) > extrusionOpacity(4, 5, 80));
assert.equal(textExtrusion(combinedLayer.textEffect).depth, 25);
const combinedSvg = renderToStaticMarkup(
  LabelArtwork({ ...artworkProps, design: combinedDesign }),
);
assert.equal(
  (combinedSvg.match(/<text\b/g) ?? []).length,
  24,
  "Five extruded cylinders plus an opaque front cylinder",
);
assert.ok(combinedSvg.includes('opacity="0.19999999999999996"'));
assert.match(combinedSvg, /matrix\(1 /, "Copies retain cylinder tilt");
const maximal = parseDesign({
  ...original,
  A: [
    {
      ...combinedLayer,
      textEffect: {
        ...combinedLayer.textEffect,
        segments: 64,
        extrusion: { depth: 999, angle: 999, steps: 999, fade: 999 },
      },
    },
  ],
}).A[0].textEffect;
assert.equal(maximal.extrusion.steps, cylinderExtrusionSteps(64));
assert.equal(maximal.extrusion.fade, 300);
assert.equal(extrusionOpacity(1, 10, 300), 0.7);
assert.equal(extrusionOpacity(5, 10, 300), 0);
assert.equal(extrusionOpacity(10, 10, 300), 0);
assert.equal(extrusionOpacity(0, 10, 300), 1);
assert.equal(
  parseDesign({
    ...combinedDesign,
    A: [
      {
        ...combinedLayer,
        textEffect: {
          type: "extrusion",
          depth: 25,
          angle: 45,
          steps: 5,
          fade: 300,
        },
      },
    ],
  }).A[0].textEffect.fade,
  300,
);
assert.ok((maximal.extrusion.steps + 1) * 64 <= 1536);
let effectHistory = { present: original, past: [], future: [] };
effectHistory = designReducer(effectHistory, {
  type: "change",
  change: () => combinedDesign,
});
effectHistory = designReducer(effectHistory, { type: "undo" });
assert.deepEqual(effectHistory.present, original);
effectHistory = designReducer(effectHistory, { type: "redo" });
assert.deepEqual(
  effectHistory.present.A[0].textEffect,
  combinedLayer.textEffect,
);
console.log(
  "Combined effects: 3000px size, fade, SVG projection, bounded node count, persistence and undo/redo passed.",
);
const coloredImage = {
  ...original.A[0],
  id: "colored-image",
  kind: "image",
  imageFill: "#ff3300",
  imageInverted: false,
};
const imageDesign = { ...original, A: [coloredImage] };
assert.equal(
  parseDesign(JSON.parse(JSON.stringify(imageDesign))).A[0].imageFill,
  "#ff3300",
);
const coloredImageSvg = renderToStaticMarkup(
  LabelArtwork({ ...artworkProps, design: imageDesign }),
);
assert.match(coloredImageSvg, /flood-color="#ff3300"/);
assert.match(coloredImageSvg, /in2="SourceAlpha"/);
const invertedDesign = {
  ...original,
  A: [
    {
      ...coloredImage,
      imageRole: "brand-logo",
      imageFill: undefined,
      imageInverted: true,
    },
  ],
};
assert.equal(
  parseDesign(JSON.parse(JSON.stringify(invertedDesign))).A[0].imageInverted,
  true,
);
assert.match(
  renderToStaticMarkup(
    LabelArtwork({ ...artworkProps, design: invertedDesign }),
  ),
  /tableValues="1 0"/,
);
console.log("Image fill and inversion: persistence and SVG filters passed.");
const croppedBarcode = {
  ...coloredImage,
  imageRole: "barcode",
  image: "data:image/png;base64,aGVsbG8=",
  imageFill: undefined,
  imageBarColor: "#ff0000",
  imageCrop: { top: 10, right: 15, bottom: 20, left: 5 },
};
const cropDesign = { ...original, A: [croppedBarcode] };
const restoredCrop = parseDesign(JSON.parse(JSON.stringify(cropDesign))).A[0];
assert.deepEqual(restoredCrop.imageCrop, croppedBarcode.imageCrop);
assert.equal(restoredCrop.imageBarColor, "#ff0000");
const cropSvg = renderToStaticMarkup(
  LabelArtwork({ ...artworkProps, design: cropDesign }),
);
assert.match(cropSvg, /image-crop-colored-image/);
assert.match(cropSvg, /tableValues="1 1"/);
assert.match(cropSvg, /tableValues="0 1"/);
const boundedCrop = parseDesign({
  ...original,
  A: [
    {
      ...croppedBarcode,
      imageCrop: { top: -2, bottom: 100, left: 0, right: 0 },
    },
  ],
}).A[0];
assert.equal(boundedCrop.imageCrop.top, 0);
assert.equal(boundedCrop.imageCrop.bottom, 45);
console.log(
  "Image crop and barcode color: persistence, bounds and exported SVG passed.",
);
const cropRounded = {
  ...croppedBarcode,
  x: 300,
  y: 300,
  width: 200,
  imageRatio: 2,
  borderRadius: 99,
};
assert.deepEqual(imageCropBounds(cropRounded), {
  x: 210,
  y: 260,
  width: 160,
  height: 70,
  rx: 35,
});
const cropRoundedSvg = renderToStaticMarkup(
  LabelArtwork({ ...artworkProps, design: { ...original, A: [cropRounded] } }),
);
assert.match(cropRoundedSvg, /x="210" y="260" width="160" height="70" rx="35"/);
const backgroundDesign = {
  ...original,
  A: [{ ...croppedBarcode, imageBarBackground: "#0000ff" }],
};
assert.equal(parseDesign(backgroundDesign).A[0].imageBarBackground, "#0000ff");
const backgroundSvg = renderToStaticMarkup(
  LabelArtwork({ ...artworkProps, design: backgroundDesign }),
);
assert.match(backgroundSvg, /tableValues="1 0"/);
assert.match(backgroundSvg, /tableValues="0 1"/);
for (const layer of [
  { ...croppedBarcode, imageBarColor: undefined, imageInverted: true },
  { ...coloredImage, imageFill: undefined, imageInverted: true },
]) {
  assert.doesNotMatch(
    renderToStaticMarkup(
      LabelArtwork({ ...artworkProps, design: { ...original, A: [layer] } }),
    ),
    /tableValues="1 0"/,
    "Only brand logos may invert",
  );
}
assert.equal(imageRole({ name: "Strange Animals logo" }), "brand-logo");
assert.equal(imageRole({ name: "Barcode EAN13 · 5901234123457" }), "barcode");
assert.equal(imageRole({ name: "renamed", imageRole: "barcode" }), "barcode");
console.log(
  "Cropped rounded corners, barcode background and logo-only inversion passed.",
);
const normalizingHistory = {
  present: cropDesign,
  past: [original],
  future: [backgroundDesign],
  group: "crop",
};
const normalizedHistory = designReducer(normalizingHistory, {
  type: "normalize",
  change: (current) => ({
    ...current,
    A: current.A.map((layer) =>
      layer.id === croppedBarcode.id
        ? {
            ...layer,
            imageBarSource: { bars: "#ffffff", background: "#000000" },
          }
        : layer,
    ),
  }),
});
assert.equal(normalizedHistory.past.length, 1);
assert.equal(normalizedHistory.future.length, 1);
assert.equal(normalizedHistory.group, "crop");
assert.equal(
  designReducer(normalizedHistory, { type: "undo" }).present,
  normalizedHistory.past[0],
);
for (const palette of [
  { bars: "#ff0000", background: "#00ffff" },
  { bars: "#222222", background: "#eeeeee" },
]) {
  const matrix = barcodeSourceMatrix(palette).split(" ").map(Number);
  for (const [color, expected] of [
    [palette.bars, 0],
    [palette.background, 1],
  ]) {
    const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
    for (let row = 0; row < 3; row++)
      assert.ok(
        Math.abs(
          rgb.reduce(
            (sum, value, i) => sum + value * matrix[row * 5 + i],
            matrix[row * 5 + 4],
          ) - expected,
        ) < 1e-9,
      );
  }
}
assert.equal(
  barcodeSourceMatrix({ bars: "#000000", background: "#000000" })
    .split(" ")
    .map(Number)
    .every(Number.isFinite),
  true,
);
for (const arc of ["top", "bottom"]) {
  for (const align of ["start", "middle", "end"]) {
    const arcLayer = {
      ...makeLayer("circular", "arc-effects"),
      text: "CURVED TYPE",
      arc,
      align,
      angle: 20,
      textEffect: {
        type: "extrusion",
        depth: 15,
        angle: 45,
        steps: 4,
        fade: 50,
      },
    };
    const arcDesign = { ...original, A: [arcLayer] };
    assert.deepEqual(
      parseDesign(JSON.parse(JSON.stringify(arcDesign))).A[0].textEffect,
      arcLayer.textEffect,
    );
    const svg = renderToStaticMarkup(
      LabelArtwork({ ...artworkProps, design: arcDesign }),
    );
    assert.equal(
      (svg.match(/<textPath\b/g) ?? []).length,
      5,
      "Arc extrusion copies keep their textPath",
    );
    assert.match(svg, /opacity="0.5"/);
    assert.ok(svg.includes(circularPath(arcLayer)));
    const combinedArc = {
      ...arcLayer,
      textEffect: {
        type: "cylinder",
        radius: 170,
        span: 150,
        segments: 12,
        tilt: 30,
        extrusion: arcLayer.textEffect,
      },
    };
    const combinedArcDesign = { ...original, A: [combinedArc] };
    const slices = circularCylinderSlices(combinedArc);
    assert.equal(slices.length, 12);
    for (const slice of slices)
      assert.doesNotMatch(slice.transform, /NaN|Infinity/);
    const combinedArcSvg = renderToStaticMarkup(
      LabelArtwork({ ...artworkProps, design: combinedArcDesign }),
    );
    assert.equal(
      (combinedArcSvg.match(/<textPath\b/g) ?? []).length,
      60,
      "Cylinder projects every curved copy and front face",
    );
    assert.equal(
      (combinedArcSvg.match(/id="test-arc-cylinder-/g) ?? []).length,
      12,
      "Slice clip definitions are shared by the depth copies",
    );
    assert.match(combinedArcSvg, /transform="matrix\(/);
    assert.match(combinedArcSvg, /rotate\(20 300 300\)/);
    const restored = parseDesign(JSON.parse(JSON.stringify(combinedArcDesign)))
      .A[0];
    assert.equal(restored.textEffect.type, "cylinder");
    assert.equal(restored.textEffect.extrusion.fade, 50);
    assert.equal(restored.arc, arc);
    assert.equal(restored.align, align);
  }
}
assert.deepEqual(
  circularCylinderSlices(makeLayer("circular", "plain-arc")),
  [],
);
console.log(
  "Arc text: extrusion, cylinder, combined effects, shared clips, fade, alignment and persistence passed.",
);
for (const kind of ["text", "circular", "image"]) {
  const layer = {
    ...makeLayer(kind, `blur-${kind}`),
    blur: 6,
    image: kind === "image" ? "data:image/png;base64,aGVsbG8=" : undefined,
  };
  const design = { ...original, A: [layer] };
  assert.equal(parseDesign(JSON.parse(JSON.stringify(design))).A[0].blur, 6);
  const svg = renderToStaticMarkup(
    LabelArtwork({
      ...artworkProps,
      design,
      guides: true,
      selected: kind === "text" ? undefined : layer.id,
    }),
  );
  assert.match(svg, /filter:blur\(6px\)/);
  assert.equal(
    (svg.match(/filter:blur/g) ?? []).length,
    1,
    "Only artwork, not selection guides, receives blur",
  );
  assert.equal(
    parseDesign({ ...original, A: [{ ...layer, blur: -1 }] }).A[0].blur,
    0,
  );
  assert.equal(
    parseDesign({ ...original, A: [{ ...layer, blur: 99 }] }).A[0].blur,
    40,
  );
}
const blurred3dDesign = {
  ...combinedDesign,
  A: [{ ...combinedLayer, blur: 3 }],
};
const blurred3dSvg = renderToStaticMarkup(
  LabelArtwork({ ...artworkProps, design: blurred3dDesign }),
);
assert.equal(
  (blurred3dSvg.match(/filter:blur\(3px\)/g) ?? []).length,
  1,
  "A single blur covers the full combined effect",
);
assert.equal((blurred3dSvg.match(/<text\b/g) ?? []).length, 24);
let blurHistory = { past: [], present: combinedDesign, future: [] };
blurHistory = designReducer(blurHistory, {
  type: "change",
  change: () => blurred3dDesign,
});
assert.equal(blurHistory.present.A[0].blur, 3);
blurHistory = designReducer(blurHistory, { type: "undo" });
assert.deepEqual(blurHistory.present, combinedDesign);
assert.equal(designReducer(blurHistory, { type: "redo" }).present.A[0].blur, 3);
assert.doesNotMatch(
  renderToStaticMarkup(
    LabelArtwork({ ...artworkProps, design: combinedDesign }),
  ),
  /filter:blur/,
);
console.log(
  "Blur: text, arc, image, combined 3D, default off, persistence, bounds and undo/redo passed.",
);
const blurBands = extrusionBlurBands(200, 40);
assert.ok(
  blurBands.length <= 6,
  "Depth blur uses at most six shared render passes",
);
assert.equal(blurBands[0].blur, 40);
assert.equal(blurBands.at(-1).blur, 0);
assert.deepEqual(
  blurBands.flatMap((band) => band.steps),
  Array.from({ length: 200 }, (_, i) => 200 - i),
);
for (let i = 1; i < blurBands.length; i++)
  assert.ok(blurBands[i].blur < blurBands[i - 1].blur);
assert.equal(extrusionBlurBands(200, 0).length, 1);
assert.equal(extrusionBlurBands(200, 99)[0].blur, 40);
for (const kind of ["text", "circular"]) {
  for (const cylinder of [false, true]) {
    const settings = {
      depth: 30,
      angle: 45,
      steps: 12,
      fade: 60,
      depthBlur: 10,
    };
    const layer = {
      ...makeLayer(kind, "depth-blur"),
      text: "DEPTH BLUR",
      textEffect: cylinder
        ? {
            type: "cylinder",
            radius: 170,
            span: 150,
            segments: 12,
            tilt: 20,
            extrusion: settings,
          }
        : { type: "extrusion", ...settings },
    };
    const design = { ...original, A: [layer] };
    assert.equal(
      textExtrusion(
        parseDesign(JSON.parse(JSON.stringify(design))).A[0].textEffect,
      ).depthBlur,
      10,
    );
    const svg = renderToStaticMarkup(LabelArtwork({ ...artworkProps, design }));
    assert.ok((svg.match(/data-extrusion-blur=/g) ?? []).length <= 6);
    assert.match(svg, /filter:blur\(10px\)/);
    assert.equal(
      (svg.match(/<text\b/g) ?? []).length,
      cylinder ? (kind === "circular" ? 12 : 10) * 13 : 13,
    );
    const sharpLayer = {
      ...layer,
      textEffect: cylinder
        ? { ...layer.textEffect, extrusion: { ...settings, depthBlur: 0 } }
        : { ...layer.textEffect, depthBlur: 0 },
    };
    const sharpSvg = renderToStaticMarkup(
      LabelArtwork({
        ...artworkProps,
        design: { ...original, A: [sharpLayer] },
      }),
    );
    assert.doesNotMatch(sharpSvg, /data-extrusion-blur|filter:blur/);
    const textNodes = (markup) =>
      markup.match(/<text\b[\s\S]*?<\/text>/g) ?? [];
    assert.equal(
      textNodes(svg).at(-1),
      textNodes(sharpSvg).at(-1),
      "The front face remains unchanged",
    );
  }
}
const depthBlurHistory = designReducer(
  { past: [], present: original, future: [] },
  {
    type: "change",
    change: (design) => ({
      ...design,
      A: [
        {
          ...design.A[0],
          textEffect: {
            type: "extrusion",
            depth: 30,
            angle: 45,
            steps: 12,
            depthBlur: 10,
          },
        },
      ],
    }),
  },
);
assert.deepEqual(
  designReducer(depthBlurHistory, { type: "undo" }).present,
  original,
);
assert.equal(
  designReducer(designReducer(depthBlurHistory, { type: "undo" }), {
    type: "redo",
  }).present.A[0].textEffect.depthBlur,
  10,
);
console.log(
  "Depth blur: bounded shared passes, monotonic depth, sharp front, arc/cylinder, save and undo/redo passed.",
);
const closedLayer = {
  ...makeLayer("text", "closed-cylinder"),
  text: "LOOP",
  textEffect: {
    type: "cylinder",
    radius: 170,
    span: 130,
    segments: 24,
    tilt: 25,
    closed: true,
    backBlur: 20,
  },
};
const closedLayout = cylinderTextLayout(closedLayer);
assert.equal(closedLayout.segments.length, 24);
assert.ok(closedLayout.segments.some((segment) => segment.angle < -170));
assert.ok(closedLayout.segments.some((segment) => segment.angle > 170));
assert.ok(
  closedLayout.segments.some((segment) => segment.horizontalScale === -1),
);
assert.ok(
  closedLayout.segments.some((segment) => segment.horizontalScale === 1),
);
assert.ok((closedCylinderText(closedLayer).match(/LOOP/g) ?? []).length > 1);
assert.equal(
  closedLayer.text,
  "LOOP",
  "Closing must not modify editable Content",
);
for (const segment of closedLayout.segments)
  assert.ok(Object.values(segment).every(Number.isFinite));
const backBands = cylinderBackBlurBands(
  closedLayout.segments.map((segment) => segment.angle),
  20,
);
assert.ok(backBands.length <= 6);
assert.equal(backBands[0].blur, 20);
assert.equal(backBands.at(-1).blur, 0);
assert.equal(new Set(backBands.flatMap((band) => band.indices)).size, 24);
const depthOrder = backBands
  .flatMap((band) => band.indices)
  .map((i) => 1 - Math.cos((closedLayout.segments[i].angle * Math.PI) / 180));
for (let i = 1; i < depthOrder.length; i++)
  assert.ok(depthOrder[i] <= depthOrder[i - 1] + 1e-9);
for (const kind of ["text", "circular"]) {
  const layer = {
    ...closedLayer,
    kind,
    textEffect: {
      ...closedLayer.textEffect,
      extrusion: { depth: 20, angle: 45, steps: 4, fade: 30, depthBlur: 10 },
    },
  };
  const design = { ...original, A: [layer] };
  const saved = parseDesign(JSON.parse(JSON.stringify(design))).A[0];
  assert.equal(saved.textEffect.closed, true);
  assert.equal(saved.textEffect.backBlur, 20);
  assert.equal(saved.textEffect.span, 130);
  assert.equal(saved.text, "LOOP");
  const svg = renderToStaticMarkup(LabelArtwork({ ...artworkProps, design }));
  assert.equal((svg.match(/<text\b/g) ?? []).length, 120);
  assert.doesNotMatch(
    svg,
    /textLength=/,
    "Closed cylinder must preserve natural letter spacing",
  );
  assert.match(svg, /data-cylinder-blur="20"/);
  assert.doesNotMatch(svg, /NaN|Infinity/);
  assert.ok((svg.match(/filter:blur/g) ?? []).length <= 42);
  if (kind === "circular") assert.match(svg, /startOffset="0%"/);
  else assert.match(svg, /matrix\(-1 /, "Back-facing panels are mirrored");
  const openLayer = {
    ...layer,
    textEffect: { ...layer.textEffect, closed: false, backBlur: 0 },
  };
  assert.ok(
    cylinderTextLayout(openLayer).segments.every(
      (segment) => Math.abs(segment.angle) < 90,
    ),
  );
}
const heavyClosedLayer = {
  ...closedLayer,
  textEffect: {
    ...closedLayer.textEffect,
    segments: 64,
    extrusion: { depth: 50, angle: 45, steps: 200, fade: 0, depthBlur: 20 },
  },
};
const heavyClosedSvg = renderToStaticMarkup(
  LabelArtwork({
    ...artworkProps,
    design: { ...original, A: [heavyClosedLayer] },
  }),
);
assert.ok(
  (heavyClosedSvg.match(/filter:blur/g) ?? []).length <= 42,
  "Combined focus filters must be shared across depth copies",
);
assert.ok((heavyClosedSvg.match(/<text\b/g) ?? []).length <= 1536);
const closedHistory = designReducer(
  { past: [], present: original, future: [] },
  { type: "change", change: () => ({ ...original, A: [closedLayer] }) },
);
assert.deepEqual(
  designReducer(closedHistory, { type: "undo" }).present,
  original,
);
assert.equal(
  designReducer(designReducer(closedHistory, { type: "undo" }), {
    type: "redo",
  }).present.A[0].textEffect.closed,
  true,
);
console.log(
  "Cylinder 360: repeated content, mirrored back panels, back-to-front order, focus bands, bounded combined passes, save and undo passed.",
);
const rememberedSettings = {
  cylinder: { ...closedLayer.textEffect },
  extrusion: { depth: 35, angle: 60, steps: 200, fade: 250, depthBlur: 12 },
};
const pausedLayer = {
  ...closedLayer,
  textEffect: undefined,
  textEffectSettings: rememberedSettings,
};
const pausedDesign = { ...original, A: [pausedLayer] };
const restoredPausedLayer = parseDesign(
  JSON.parse(JSON.stringify(pausedDesign)),
).A[0];
assert.equal(restoredPausedLayer.textEffect, undefined);
assert.deepEqual(restoredPausedLayer.textEffectSettings, rememberedSettings);
const pausedSvg = renderToStaticMarkup(
  LabelArtwork({
    ...artworkProps,
    design: { ...original, A: [restoredPausedLayer] },
  }),
);
assert.doesNotMatch(pausedSvg, /data-cylinder-blur|data-extrusion-blur/);
assert.equal(
  (pausedSvg.match(/<text\b/g) ?? []).length,
  1,
  "Remembered effects must remain disabled",
);
assert.equal(
  parseDesign({
    ...original,
    A: [
      {
        ...makeLayer("image", "no-cached-effects"),
        textEffectSettings: rememberedSettings,
      },
    ],
  }).A[0].textEffectSettings,
  undefined,
);
const pausedHistory = designReducer(
  { past: [], present: original, future: [] },
  { type: "change", change: () => pausedDesign },
);
assert.deepEqual(
  designReducer(pausedHistory, { type: "undo" }).present,
  original,
);
assert.deepEqual(
  designReducer(designReducer(pausedHistory, { type: "undo" }), {
    type: "redo",
  }).present.A[0].textEffectSettings,
  rememberedSettings,
);
console.log(
  "Remembered effects: disabled save/import, no render leakage, image safety and undo/redo passed.",
);
assert.equal(cylinderShading(0, 100), 0);
assert.equal(cylinderShading(180, 100), 1);
assert.equal(cylinderShading(180, 0), 0);
assert.equal(cylinderShading(180), 0.7);
assert.equal(cylinderShading(180, 250), 1);
assert.equal(cylinderShading(0, 250), 0);
assert.ok(cylinderShading(60, 250) > cylinderShading(60, 100));
assert.ok(cylinderShading(150, 90) > cylinderShading(150, 20));
for (const kind of ["text", "circular"]) {
  const shaded = {
    ...closedLayer,
    kind,
    color: "#ffffff",
    textEffect: { ...closedLayer.textEffect, backShading: 100 },
  };
  const design = { ...original, A: [shaded] };
  assert.equal(
    parseDesign(JSON.parse(JSON.stringify(design))).A[0].textEffect.backShading,
    100,
  );
  const dark = renderToStaticMarkup(LabelArtwork({ ...artworkProps, design }));
  const light = renderToStaticMarkup(
    LabelArtwork({
      ...artworkProps,
      design: {
        ...original,
        A: [
          { ...shaded, textEffect: { ...shaded.textEffect, backShading: 0 } },
        ],
      },
    }),
  );
  assert.notEqual(dark, light);
  assert.equal(
    parseDesign({
      ...original,
      A: [
        { ...shaded, textEffect: { ...shaded.textEffect, backShading: 999 } },
      ],
    }).A[0].textEffect.backShading,
    250,
  );
}
console.log(
  "Cylinder back shading: strength, front color, legacy default, arc and save bounds passed.",
);
for (const kind of ["text", "circular"]) {
  const layer = {
    ...makeLayer(kind, `transparent-${kind}`),
    opacity: 0.35,
    textEffect: {
      type: "cylinder",
      radius: 170,
      span: 150,
      segments: 12,
      extrusion: { depth: 15, angle: 45, steps: 4, fade: 60 },
    },
  };
  const design = { ...original, A: [layer] };
  assert.equal(
    parseDesign(JSON.parse(JSON.stringify(design))).A[0].opacity,
    0.35,
  );
  const svg = renderToStaticMarkup(LabelArtwork({ ...artworkProps, design }));
  assert.equal(
    (svg.match(/data-layer-appearance="true" opacity="0.35"/g) ?? []).length,
    1,
    "Opacity applies once to the complete text and 3D volume",
  );
  assert.match(
    renderToStaticMarkup(
      LabelArtwork({
        ...artworkProps,
        design: { ...original, A: [{ ...layer, opacity: 0 }] },
      }),
    ),
    /data-layer-appearance="true" opacity="0"/,
  );
  const history = designReducer(
    { past: [], present: original, future: [] },
    { type: "change", change: () => design },
  );
  assert.deepEqual(designReducer(history, { type: "undo" }).present, original);
  assert.equal(
    designReducer(designReducer(history, { type: "undo" }), { type: "redo" })
      .present.A[0].opacity,
    0.35,
  );
}
console.log(
  "Text opacity: straight/arc text, complete 3D volume, zero opacity, persistence and undo passed.",
);
assert.equal(cylinderOpacity(0, 100), 1);
assert.equal(cylinderOpacity(180, 100), 0);
assert.equal(cylinderOpacity(180, 50), 0.5);
assert.equal(cylinderOpacity(180, 0), 1);
assert.equal(cylinderOpacity(0, 400), 1);
assert.equal(cylinderOpacity(180, 400), 0);
assert.equal(cylinderOpacity(90, 400), 0);
assert.ok(cylinderOpacity(30, 400) < cylinderOpacity(30, 100));
assert.ok(cylinderOpacity(150, 80) < cylinderOpacity(30, 80));
assert.equal(cylinderOpacity(-150, 80), cylinderOpacity(150, 80));
for (const kind of ["text", "circular"]) {
  const layer = {
    ...closedLayer,
    kind,
    textEffect: {
      ...closedLayer.textEffect,
      backFade: 80,
      extrusion: { depth: 20, angle: 45, steps: 4, fade: 30 },
    },
  };
  const design = { ...original, A: [layer] };
  assert.equal(
    parseDesign(JSON.parse(JSON.stringify(design))).A[0].textEffect.backFade,
    80,
  );
  const transparent = renderToStaticMarkup(
    LabelArtwork({ ...artworkProps, design }),
  );
  const opaque = renderToStaticMarkup(
    LabelArtwork({
      ...artworkProps,
      design: {
        ...original,
        A: [{ ...layer, textEffect: { ...layer.textEffect, backFade: 0 } }],
      },
    }),
  );
  assert.notEqual(transparent, opaque);
  assert.equal(
    (transparent.match(/<text\b/g) ?? []).length,
    (opaque.match(/<text\b/g) ?? []).length,
  );
  assert.equal(
    parseDesign({
      ...original,
      A: [{ ...layer, textEffect: { ...layer.textEffect, backFade: 999 } }],
    }).A[0].textEffect.backFade,
    400,
  );
}
console.log(
  "Cylinder transparency: depth progression, symmetry, front opacity, persistence, bounds and combined render passed.",
);
