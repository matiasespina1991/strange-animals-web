import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/features/identity/export-diagnostics.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createExportDiagnostics } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const entries = [], info = console.info, error = console.error;
try {
  console.info = (...values) => entries.push(["info", ...values]);
  console.error = (...values) => entries.push(["error", ...values]);
  const logger = createExportDiagnostics({ format: "psd", side: "A" });
  logger.stage("load-psd-module");
  const cause = new Error("Missing module export");
  logger.fail(cause);
  assert.equal(entries.at(-1)[0], "error");
  assert.equal(entries.at(-1)[2].stage, "load-psd-module");
  assert.strictEqual(entries.at(-1)[3], cause, "Keep the actual Error object and stack");
  assert.ok(entries[0][2].exportId);
  assert.ok(entries.every((entry) => entry[2].exportId === entries[0][2].exportId));
  logger.complete();
  assert.equal(entries.at(-1)[2].stage, "complete");
} finally { console.info = info; console.error = error; }
const outlines = await readFile(new URL("../src/features/identity/psd-text-outlines.ts", import.meta.url), "utf8");
assert.match(outlines, /import \* as opentype from "opentype.js"/, "Use ESM namespace, never a non-existent default export");
console.log("Export diagnostics: correlation ID, stages, real error/stack and OpenType import regression passed.");
