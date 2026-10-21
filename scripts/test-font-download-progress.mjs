import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
const data = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const { readFontBytes } = await import(
  data(
    compile(
      await readFile(
        new URL(
          "../src/features/identity/font-download-progress.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  )
);
const controller = new AbortController();
const stream = () =>
  new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array([1, 2, 3]));
      c.enqueue(new Uint8Array([4, 5, 6]));
      c.close();
    },
  });
const events = [];
const bytes = await readFontBytes(
  new Response(stream(), { headers: { "content-length": "6" } }),
  controller.signal,
  100,
  (event) => events.push(event),
);
assert.deepEqual([...bytes], [1, 2, 3, 4, 5, 6]);
assert.deepEqual(events[0], { phase: "downloading", loaded: 0, total: 6 });
assert.deepEqual(events.at(-1), { phase: "downloading", loaded: 6, total: 6 });
const unknown = [];
await readFontBytes(new Response(stream()), controller.signal, 100, (event) =>
  unknown.push(event),
);
assert.ok(
  unknown.every((event) => event.total === null),
  "Missing size must never produce a made-up percentage",
);
const encoded = [];
await readFontBytes(
  new Response(stream(), {
    headers: { "content-length": "4", "content-encoding": "gzip" },
  }),
  controller.signal,
  100,
  (event) => encoded.push(event),
);
assert.ok(
  encoded.every((event) => event.total === null),
  "Compressed wire size must not be compared to decoded bytes",
);
await assert.rejects(
  readFontBytes(new Response(stream()), controller.signal, 4, () => {}),
  /size limit/,
);
await assert.rejects(
  readFontBytes(
    new Response(stream(), { headers: { "content-length": "6" } }),
    controller.signal,
    4,
    () => {},
  ),
  /size limit/,
);
const abort = new AbortController();
let cancelCalled = false;
const pending = readFontBytes(
  new Response(
    new ReadableStream({
      cancel() {
        cancelCalled = true;
      },
    }),
  ),
  abort.signal,
  100,
  () => {},
);
const rejected = assert.rejects(pending, { name: "AbortError" });
abort.abort();
await rejected;
assert.equal(
  cancelCalled,
  true,
  "Cancelling a filtered font must stop its stream",
);
const { FontLoadQueue } = await import(
  data(
    compile(
      await readFile(
        new URL("../src/features/identity/font-load-queue.ts", import.meta.url),
        "utf8",
      ),
    ),
  )
);
const queue = new FontLoadQueue(1);
const firstEvents = [],
  secondEvents = [];
let report, resolve;
const firstController = new AbortController();
const first = queue.load(
  "shared",
  (_signal, notify) => {
    report = notify;
    return new Promise((done) => {
      resolve = done;
    });
  },
  firstController.signal,
  (event) => firstEvents.push(event),
);
await new Promise((done) => setImmediate(done));
report({ phase: "downloading", loaded: 4, total: 10 });
const second = queue.load(
  "shared",
  () => {
    throw new Error("Duplicate download");
  },
  undefined,
  (event) => secondEvents.push(event),
);
assert.equal(
  secondEvents.at(-1).loaded,
  4,
  "A new subscriber must receive current progress immediately",
);
const firstRejected = assert.rejects(first, { name: "AbortError" });
firstController.abort();
await firstRejected;
report({ phase: "downloading", loaded: 8, total: 10 });
assert.equal(
  firstEvents.at(-1).loaded,
  4,
  "Removed consumers must not receive progress",
);
assert.equal(secondEvents.at(-1).loaded, 8);
resolve("ready");
assert.equal(await second, "ready");
const component = compile(
  await readFile(
    new URL(
      "../src/features/identity/FontLoadingProgress.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
)
  .replace(
    '"react/jsx-runtime"',
    JSON.stringify(import.meta.resolve("react/jsx-runtime")),
  )
  .replace(
    '"lucide-react"',
    JSON.stringify(import.meta.resolve("lucide-react")),
  );
const { FontLoadingProgress } = await import(data(component));
const markup = (progress) =>
  renderToStaticMarkup(
    FontLoadingProgress({ progress, name: "Test", color: "black" }),
  );
assert.ok(
  markup({ phase: "downloading", loaded: 5, total: 10 }).includes(
    'aria-valuenow="50"',
  ),
);
const decoding = markup({ phase: "decoding", loaded: 10, total: 10 });
assert.ok(decoding.includes("Preparing font"));
assert.ok(!decoding.includes("aria-valuenow"));
assert.ok(
  !markup({ phase: "downloading", loaded: 5, total: null }).includes(
    "aria-valuenow",
  ),
);
console.log(
  "Font progress: real byte counts, unknown/compressed totals, size limits, cancellation, shared progress and accessible circle passed.",
);
