import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const moduleFrom = async (file) => {
  const source = await readFile(new URL(file, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );
};
const { FontLoadQueue } = await moduleFrom(
  "../src/features/identity/font-load-queue.ts",
);
const { fontVisualPriority } = await moduleFrom(
  "../src/features/identity/font-visual-priority.ts",
);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const queue = new FontLoadQueue(1);
const started = [];
const done = new Map();
const loader = (name) => () =>
  new Promise((resolve) => {
    started.push(name);
    done.set(name, resolve);
  });
// A lower card's metadata returns first. Its bytes must wait for the earlier card.
const releaseMetadata = queue.reserve(() => 10);
const lower = queue.load(
  "lower",
  loader("lower"),
  undefined,
  undefined,
  () => 50,
);
await tick();
assert.deepEqual(
  started,
  [],
  "Fast metadata must not bypass earlier unresolved cards",
);
const upper = queue.load(
  "upper",
  loader("upper"),
  undefined,
  undefined,
  () => 20,
);
releaseMetadata();
await tick();
assert.deepEqual(started, ["upper"]);
done.get("upper")("upper-ready");
await upper;
await tick();
assert.deepEqual(started, ["upper", "lower"]);
done.get("lower")("lower-ready");
await lower;
await tick();
// Re-evaluate live positions after scrolling, not stale enqueue order.
const blocker = queue.load("blocker", loader("blocker"));
await tick();
let firstPriority = 20,
  secondPriority = 40;
const first = queue.load(
  "first",
  loader("first"),
  undefined,
  undefined,
  () => firstPriority,
);
const second = queue.load(
  "second",
  loader("second"),
  undefined,
  undefined,
  () => secondPriority,
);
firstPriority = 500;
secondPriority = 5;
queue.refresh();
done.get("blocker")("done");
await blocker;
await tick();
assert.equal(
  started.at(-1),
  "second",
  "A newly visible earlier sample must jump queued offscreen work",
);
done.get("second")("done");
await second;
await tick();
assert.equal(started.at(-1), "first");
done.get("first")("done");
await first;
const rank = (top, bottom, left = 0) =>
  fontVisualPriority({ top, bottom, left }, 800, 1200);
assert.ok(rank(100, 200) < rank(300, 400));
assert.ok(
  rank(100, 200, 0) < rank(100, 200, 600),
  "Same-row order must be left to right",
);
assert.ok(
  rank(700, 900) < rank(850, 1000),
  "Visible samples must precede below-screen prefetch",
);
assert.ok(
  rank(850, 1000) < rank(-200, -10),
  "Downward prefetch must precede samples already passed",
);
// Removing an earlier card must release its reservation and unblock the queue.
const releaseRemoved = queue.reserve(() => 0);
const pending = queue.load(
  "after-removal",
  loader("after-removal"),
  undefined,
  undefined,
  () => 10,
);
await tick();
assert.ok(!started.includes("after-removal"));
releaseRemoved();
await tick();
assert.equal(started.at(-1), "after-removal");
done.get("after-removal")("done");
await pending;
console.log(
  "Font priority: metadata races, top-to-bottom order, live scroll reprioritization, columns and removed-card reservations passed.",
);
