import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../src/features/identity/font-load-queue.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { FontLoadQueue } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const queue = new FontLoadQueue(1);
const started = [];
const releases = new Map();
const load = (name) => (signal) =>
  new Promise((resolve, reject) => {
    started.push(name);
    releases.set(name, resolve);
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });
const oldFilter = new AbortController();
const active = queue.load("old-active", load("old-active"), oldFilter.signal);
const waiting = queue.load(
  "old-waiting",
  load("old-waiting"),
  oldFilter.signal,
);
const activeRejected = assert.rejects(active, { name: "AbortError" });
const waitingRejected = assert.rejects(waiting, { name: "AbortError" });
await tick();
assert.deepEqual(started, ["old-active"], "Concurrency must be bounded");
oldFilter.abort();
await Promise.all([activeRejected, waitingRejected]);
const current = queue.load("current-filter", load("current-filter"));
await tick();
assert.deepEqual(
  started,
  ["old-active", "current-filter"],
  "Filtered-out queued fonts must never start",
);
releases.get("current-filter")("ready");
assert.equal(await current, "ready");
assert.equal(
  await queue.load("current-filter", () => {
    throw new Error("Cached font downloaded again");
  }),
  "ready",
);
const firstConsumer = new AbortController();
const secondConsumer = new AbortController();
const first = queue.load("shared", load("shared"), firstConsumer.signal);
const second = queue.load("shared", load("duplicate"), secondConsumer.signal);
const firstRejected = assert.rejects(first, { name: "AbortError" });
await tick();
firstConsumer.abort();
await firstRejected;
releases.get("shared")("shared-ready");
assert.equal(
  await second,
  "shared-ready",
  "One consumer must not cancel another consumer's font",
);
assert.ok(
  !started.includes("duplicate"),
  "Concurrent consumers must share downloads",
);
queue.delete("shared");
assert.ok(![...queue.keys()].includes("shared"));
const page = await readFile(
  new URL("../src/features/identity/IdentityFontsPage.tsx", import.meta.url),
  "utf8",
);
assert.ok(page.includes("loadFontVariant(font, variant, controller.signal,"));
assert.ok(page.includes("controller.abort()"));
assert.ok(page.includes("FontLoadingProgress"));
assert.ok(
  page.includes("const term = search.trim()"),
  "Filter loading must not use stale deferred search",
);
const start = page.indexOf("  const fontSections = useMemo(");
const end = page.indexOf("  useEffect(() =>", start);
const filterSource = `export function sections({search, fontPreferences, fonts, hiddenCategoryLabels, hiddenUseCaseLabels}) {
  const useMemo = callback => callback();
  const UNCATEGORIZED_LABEL = "Uncategorized";
  const UNASSIGNED_USE_CASE_LABEL = "Unassigned";
  const compareFontSectionCategoryLabels = (a,b) => a.localeCompare(b);
  ${page.slice(start, end)}
  return fontSections;
}`;
const filters = ts.transpileModule(filterSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { sections } = await import(
  `data:text/javascript;base64,${Buffer.from(filters).toString("base64")}`
);
const filterArguments = {
  search: "Japanese",
  fontPreferences: {
    pinnedFontIds: ["latin"],
    favoriteFontIds: [],
    showOnlyFavorites: false,
  },
  fonts: [
    {
      id: "latin",
      name: "Latin font",
      parentCategory: "Serif",
      formats: ["otf"],
      useCases: [],
    },
    {
      id: "jp",
      name: "Japanese font",
      parentCategory: "Non-Latin Script",
      formats: ["otf"],
      useCases: [],
    },
  ],
  hiddenCategoryLabels: new Set(),
  hiddenUseCaseLabels: new Set(),
};
assert.deepEqual(
  sections(filterArguments).flatMap((section) =>
    section.fonts.map((font) => font.id),
  ),
  ["jp"],
  "Pinned fonts must respect search too",
);
assert.deepEqual(
  sections({
    ...filterArguments,
    search: "",
    hiddenCategoryLabels: new Set(["Serif"]),
  }).flatMap((section) => section.fonts.map((font) => font.id)),
  ["jp"],
  "Hidden categories must not mount font loaders",
);
console.log(
  "Font loading: concurrency, active/queued cancellation, cache reuse, shared consumers and spinner wiring passed.",
);
