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
assert.match(
  circularPath({ ...circular, arcDegrees: 300 }),
  / 0 1 0 /,
  "Arcs over 180 degrees must use the large-arc flag",
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
assert.throws(() => parseDesign({ ...original, A: [] }), /1 y 50/);
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
