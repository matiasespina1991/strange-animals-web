import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";

const source = readFileSync("src/features/identity/FontFilterLabPage.tsx", "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
}).outputText;
const exports = {};
vm.runInNewContext(code, {
  exports, React,
  require: name => {
    if (name === "lucide-react") return icons;
    if (name.endsWith(".css")) return {};
    throw new Error(`Unexpected dependency: ${name}`);
  },
});
const html = renderToStaticMarkup(React.createElement(exports.default));
assert.equal((html.match(/<article\b/g) ?? []).length, 10);
assert.equal((html.match(/class="ffl-chips"/g) ?? []).length, 10);
assert.equal((html.match(/Categories — two rows, visual mockup/g) ?? []).length, 10);
for (let i = 1; i <= 10; i++) assert.ok(html.includes(`id="concept-${i}"`));
assert.equal((html.match(/placeholder="Search all available fonts…"/g) ?? []).length, 10);
assert.doesNotMatch(source, /onClick=|onChange=|useState|fetch\(|localStorage|firebase/);
const css = readFileSync("src/features/identity/font-filter-lab.css", "utf8");
assert.match(css, /grid-template-rows:repeat\(2,34px\)/);
assert.match(css, /\.ffl-tabs[^}]+border-bottom:1px/);
assert.match(css, /\.ffl-tabs button::after[^}]+height:3px/);
const app = readFileSync("src/App.tsx", "utf8");
assert.match(app, /const FontFilterLabPage = import.meta.env.DEV/);
assert.match(app, /import.meta.env.DEV && route === "\/dev\/font-filter-lab"/);
if (process.argv.includes("--production")) {
  const files = readdirSync("dist/assets").filter(file => /\.(js|css)$/.test(file));
  for (const file of files) {
    const built = readFileSync(`dist/assets/${file}`, "utf8");
    assert.doesNotMatch(built, /ffl-concepts|ffl-panel-title|font-filter-lab|Diez maneras de entrar/, `Dev lab leaked into production: ${file}`);
  }
}
console.log("Font filter lab: 10 static concepts, two-row chips, tab hierarchy and dev-only isolation passed.");
