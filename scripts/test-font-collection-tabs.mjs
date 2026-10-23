import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
const code = ts.transpileModule(readFileSync("src/features/identity/FontCollectionTabs.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
}).outputText;
const exports = {};
vm.runInNewContext(code, { exports, React, require: () => icons });
const counts = { standard: 48, all: 1700, favorites: 12 };
let selected;
const props = { scope: "standard", counts, onSelect: scope => { selected = scope; } };
const buttons = exports.FontCollectionTabs(props).props.children;
assert.equal(buttons.length, 3);
for (const [index, scope] of ["standard", "all", "favorites"].entries()) {
  assert.equal(buttons[index].props["aria-pressed"], scope === "standard");
  buttons[index].props.onClick();
  assert.equal(selected, scope);
}
const html = renderToStaticMarkup(React.createElement(exports.FontCollectionTabs, { ...props, scope: "all" }));
assert.match(html, /All fonts/);
assert.match(html, /1,700/);
assert.equal((html.match(/<svg\b/g) ?? []).length, 3);
assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
assert.match(renderToStaticMarkup(React.createElement(exports.FontCollectionTabs, { ...props, loading: true })), /loading/);
const css = readFileSync("src/features/identity/design-configurator.css", "utf8");
assert.match(css, /\.dc-category-chips[^}]+grid-template-rows:repeat\(2,34px\)/);
assert.match(css, /\.dc-font-picker \.dc-font-collection-tabs[^}]+border-bottom:1px/);
assert.match(css, /\.dc-font-collection-tabs button::after[^}]+height:3px/);
console.log("Font collection tabs: scope actions, actual counts, loading, icons, two-row chips and visual hierarchy passed.");
