import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/features/identity/font-picker-state.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { familyIsExpanded, familyClickAction, toggleFamily } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const single = { id: "single", variantCount: 1 };
const first = { id: "first", variantCount: 4 };
const second = { id: "second", variantCount: 2 };
const visible = [single, first, second];
let expanded = new Set();
assert.equal(familyClickAction(single, expanded, false), "select");
assert.equal(familyIsExpanded(single, expanded, true), false);
assert.equal(familyClickAction(first, expanded, false), "expand");
expanded = toggleFamily(first, expanded, false, visible);
assert.equal(familyClickAction(first, expanded, false), "select");
expanded = toggleFamily(second, expanded, false, visible);
assert.ok(expanded.has(first.id) && expanded.has(second.id), "Expanding another family must not close the first");
expanded = toggleFamily(first, expanded, false, visible);
assert.ok(!expanded.has(first.id) && expanded.has(second.id), "Chevron collapses only its own family");
assert.equal(familyClickAction(second, new Set(), true), "select");
expanded = toggleFamily(first, new Set(), true, visible);
assert.deepEqual([...expanded], [second.id], "Individual collapse from See all preserves the other expanded families");
assert.deepEqual([...toggleFamily(single, expanded, false, visible)], [second.id]);
console.log("Font picker: single style, master selection, independent expansion, chevron toggle and See all passed.");

// Exercise the specimen's visibility/loading lifecycle without a browser or Firebase.
const dataModule = (value) => `data:text/javascript;base64,${Buffer.from(value).toString("base64")}`;
let states, effects, refs, stateIndex, calls, observer, resolveFont;
const fixture = () => {
  states = []; effects = []; refs = []; stateIndex = 0; calls = 0;
  globalThis.__specimenHooks = {
    useState(initial) { const index = stateIndex++; states[index] = initial; return [initial, (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }]; },
    useRef() { const ref = { current: { closest: () => ({}) } }; refs.push(ref); return ref; },
    useEffect(effect) { effects.push(effect); },
  };
  globalThis.__specimenResolve = () => { calls++; return new Promise((resolve) => { resolveFont = resolve; }); };
  globalThis.IntersectionObserver = class {
    constructor(callback) { observer = this; this.callback = callback; }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
};
const hooksModule = dataModule("export const {useState,useEffect,useRef}=globalThis.__specimenHooks;");
const fontModule = dataModule("export const resolveLabelFont=(...args)=>globalThis.__specimenResolve(...args);");
const specimenSource = await readFile(new URL("../src/features/identity/FontSpecimen.tsx", import.meta.url), "utf8");
const compileSpecimen = () => ts.transpileModule(specimenSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replace('"react"', JSON.stringify(hooksModule))
  .replace('"./design-configurator-export"', JSON.stringify(fontModule))
  .replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")));
fixture();
const { FontSpecimen } = await import(dataModule(compileSpecimen()));
const initialTree = FontSpecimen({ font: { id: "test", name: "Test" }, sample: "Sample text" });
assert.equal(initialTree.props["aria-busy"], true);
assert.ok(!JSON.stringify(initialTree).includes("Sample text"), "Never show sample text in a fallback font while loading");
const cleanup = effects[0]();
assert.equal(calls, 0, "Offscreen specimens must not download fonts");
observer.callback([{ isIntersecting: true }]);
assert.equal(calls, 1, "Entering the viewport must load without any hover");
resolveFont({ family: "Loaded Test" });
await Promise.resolve();
assert.equal(states[0], "Loaded Test");
cleanup();
// A pending font may complete after its tile is removed; it must not set state.
effects = []; stateIndex = 0;
FontSpecimen({ font: { id: "late", name: "Late" }, variantId: "bold", sample: "Hidden" });
const cleanupLate = effects[0]();
observer.callback([{ isIntersecting: true }]);
cleanupLate();
resolveFont({ family: "Too Late" });
await Promise.resolve();
assert.equal(states[0], undefined);
delete globalThis.__specimenHooks;
delete globalThis.__specimenResolve;
delete globalThis.IntersectionObserver;
console.log("Font specimens: loading indicator, no fallback, viewport loading without hover and cleanup passed.");
