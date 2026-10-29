import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const module = {};
vm.runInNewContext(ts.transpileModule(readFileSync("src/features/identity/settle-uploads.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: module });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const early = deferred(), slow = deferred(), late = deferred();
const failure = new Error("Upload failed");
const objects = new Set();
let cleaned = false, committed = false;
const save = module.settleUploads([
  early.promise,
  slow.promise.then(() => objects.add("slow.png")),
  late.promise,
]).then(() => { committed = true; }, error => {
  assert.equal(error, failure, "Preserve the original SDK error");
  objects.clear();
  cleaned = true;
});
early.reject(failure);
await new Promise(resolve => setImmediate(resolve));
assert.equal(cleaned, false, "An early rejection must not start cleanup");
slow.resolve();
await new Promise(resolve => setImmediate(resolve));
assert.equal(objects.has("slow.png"), true);
assert.equal(cleaned, false, "Wait for every upload, including later failures");
late.reject(new Error("Another failure"));
await save;
assert.equal(cleaned, true);
assert.equal(committed, false);
assert.equal(objects.size, 0, "Cleanup runs after the final write");
await module.settleUploads([Promise.resolve(), Promise.resolve()]);
await module.settleUploads([]);
const repository = readFileSync("src/features/identity/design-gallery-repository.ts", "utf8");
assert.match(repository, /await settleUploads\(\s*files\.map/);
console.log("Gallery uploads: cleanup waits for all writes, multiple failures handled, original error preserved and success allowed.");
