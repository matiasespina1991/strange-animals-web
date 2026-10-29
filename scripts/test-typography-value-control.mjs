import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";

// Exercise actual component handlers with persistent hook state across renders.
const state = [];
let cursor = 0;
const hooks = {
  useId: () => "numeric",
  useState: initial => {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], next => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
  },
};
const module = {};
vm.runInNewContext(ts.transpileModule(readFileSync("src/features/identity/TypographyValueControl.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText, { exports: module, React, require: () => hooks });
let value = 1, commits = 0;
const changes = [];
const render = () => {
  cursor = 0;
  return module.TypographyValueControl({ label: "Tracking", value, min: -10, max: 10, step: .1,
    onChange: next => { value = next; changes.push(next); }, onCommit: () => { commits++; },
  }).props.children[1];
};
render().props.onFocus();
for (const raw of ["", "-", "-2.5", "3.25"]) {
  render().props.onChange({ target: { value: raw } });
  assert.equal(render().props.value, raw, "Focused input must retain its draft");
}
assert.deepEqual(changes, [-2.5, 3.25], "Transient drafts must not become zero or NaN");
render().props.onBlur();
assert.equal(render().props.value, 3.25);
assert.deepEqual(changes, [-2.5, 3.25], "Blur must not reapply the original value");
assert.equal(commits, 1);
render().props.onFocus();
render().props.onChange({ target: { value: "99" } });
assert.equal(value, 10);
let prevented = false;
render().props.onKeyDown({ key: "Enter", preventDefault: () => { prevented = true; },
  currentTarget: { blur: () => render().props.onBlur() },
});
assert.equal(prevented, true);
assert.equal(commits, 2, "Enter uses the single blur commit boundary");
assert.equal(render().props.value, 10);
render().props.onFocus();
render().props.onChange({ target: { value: "" } });
render().props.onBlur();
assert.equal(value, 10, "Empty blur retains the last valid value");
value = -2.5; // Parent undo/external update must be visible outside editing.
assert.equal(render().props.value, -2.5);
console.log("Numeric control: live draft, negatives, decimals, transient empty, bounds, Enter/blur and external undo value passed (hook harness).");
