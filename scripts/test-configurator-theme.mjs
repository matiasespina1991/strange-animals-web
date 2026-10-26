import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import postcss from "postcss";

const compile = file => ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
} }).outputText;
const theme = {};
vm.runInNewContext(compile("src/features/identity/configurator-theme.ts"), { exports: theme });
assert.equal(theme.readConfiguratorTheme(), "light");
for (const value of [null, "light", "invalid"]) assert.equal(theme.readConfiguratorTheme({ getItem: () => value }), "light");
assert.equal(theme.readConfiguratorTheme({ getItem: () => "dark" }), "dark");
assert.equal(theme.readConfiguratorTheme({ getItem: () => { throw Error("blocked"); } }), "light");
let saved;
theme.saveConfiguratorTheme("dark", { setItem: (key, value) => { saved = [key, value]; } });
assert.deepEqual(saved, [theme.CONFIGURATOR_THEME_KEY, "dark"]);
assert.doesNotThrow(() => theme.saveConfiguratorTheme("dark", { setItem: () => { throw Error("full"); } }));
const components = {};
vm.runInNewContext(compile("src/features/identity/ConfiguratorThemeToggle.tsx"), { exports: components, React, require: () => icons });
for (const mode of ["light", "dark"]) {
  let clicks = 0;
  const button = components.ConfiguratorThemeToggle({ theme: mode, onToggle: () => { clicks++; } });
  assert.equal(button.props.type, "button");
  assert.equal(button.props["aria-label"], "Dark mode");
  assert.equal(button.props["aria-pressed"], mode === "dark");
  assert.match(button.props.title, new RegExp(mode === "dark" ? "light" : "dark"));
  button.props.onClick();
  assert.equal(clicks, 1);
  assert.match(renderToStaticMarkup(button), /<svg/);
}
const css = postcss.parse(readFileSync("src/features/identity/design-configurator-theme.css", "utf8"));
const tokens = {};
css.walkRules('.design-configurator[data-theme="dark"]', rule => rule.walkDecls(decl => { tokens[decl.prop] = decl.value; }));
const luminance = hex => {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
for (const background of ["--dc-bg", "--dc-panel", "--dc-input-bg", "--dc-selected", "--dc-hover"]) {
  for (const foreground of ["--dc-text", "--dc-muted", "--dc-accent"]) assert.ok(contrast(tokens[foreground], tokens[background]) >= 4.5, `${foreground} on ${background} needs AA text contrast`);
}
assert.ok(contrast(tokens["--dc-on-action"], tokens["--dc-action-bg"]) >= 4.5);
assert.ok(contrast(tokens["--dc-warning-text"], tokens["--dc-warning-bg"]) >= 4.5);
assert.ok(contrast(tokens["--dc-border"], tokens["--dc-input-bg"]) >= 3);
for (const path of ["src/features/identity/design-configurator.css", "src/features/identity/design-configurator-mobile.css"]) {
  const sheet = postcss.parse(readFileSync(path, "utf8"));
  assert.ok(sheet.nodes.length);
  let variables = 0;
  sheet.walkDecls(decl => { if (decl.value.includes("var(--dc-")) variables++; });
  assert.ok(variables > 5);
}
const editor = readFileSync("src/features/identity/DesignConfiguratorEditor.tsx", "utf8");
assert.match(editor, /data-theme=\{theme\}/);
assert.match(editor, /<ConfiguratorThemeToggle/);
assert.match(editor, /saveConfiguratorTheme\(theme\)/);
const header = editor.slice(editor.indexOf('<div className="dc-header-actions">'), editor.indexOf('</header>'));
assert.ok(header.indexOf("<ConfiguratorThemeToggle") < header.indexOf("<AccountControl"), "Theme button belongs before Sign in");
assert.doesNotMatch(readFileSync("src/features/identity/configurator-theme.ts", "utf8"), /LabelDesign|dispatch|DRAFT_KEY|RECOVERY_KEY/);
console.log("Configurator theme: persistence, blocked storage, accessible toggle, scoped CSS and AA palette contrast passed.");
