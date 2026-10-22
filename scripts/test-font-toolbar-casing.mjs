import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const page = readFileSync('src/features/identity/IdentityFontsPage.tsx', 'utf8');
const start = page.indexOf('        <div className="ml-px flex min-w-0 shrink-0 flex-col items-start gap-1 md:gap-2">');
const end = page.indexOf('\n\n        <button\n          ref={', start);
assert.ok(start > 0 && end > start);
assert.ok(start > page.indexOf('<DesktopFontSizeControl', page.indexOf('const renderToolbar')), 'Casing follows Font size in DOM and keyboard order');
assert.ok(end < page.indexOf('aria-label="Typography settings"', start), 'Settings comes after Casing');
assert.equal((page.match(/aria-label="Text casing"/g) ?? []).length, 1, 'No duplicate casing in the popover');
const casingFunction = page.slice(page.indexOf('function applyTextCasing('), page.indexOf('function getPreviewFontWeight('));
const casingCode = ts.transpileModule(casingFunction, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const casingContext = {};
vm.createContext(casingContext);
vm.runInContext(casingCode, casingContext);
const originalText = 'Callum callum';
const uppercaseText = casingContext.applyTextCasing(originalText, 'upper');
assert.equal(uppercaseText, 'CALLUM CALLUM');
assert.equal(casingContext.applyTextCasing(uppercaseText, 'lower'), 'callum callum', 'aa must lowercase even already-uppercase text');
assert.equal(casingContext.applyTextCasing(originalText, 'mixed'), originalText, 'Aa must keep original casing, not capitalize');
const code = ts.transpileModule(`export function Casing({textCasing,setTextCasing}) { return (${page.slice(start, end)}); }`, {
  fileName: 'test.tsx', compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
}).outputText;
const exports = {};
vm.runInNewContext(code, { React, exports });
for (const value of ['lower', 'mixed', 'upper']) {
  let selected;
  const element = exports.Casing({ textCasing: value, setTextCasing: next => { selected = next; } });
  const markup = renderToStaticMarkup(element);
  assert.equal((markup.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.equal((markup.match(/<button/g) ?? []).length, 3);
  const buttons = element.props.children[1].props.children.props.children;
  for (const [index, button] of buttons.entries()) {
    button.props.onClick();
    assert.equal(selected, ['lower', 'mixed', 'upper'][index]);
  }
}
console.log('Toolbar: casing outside popover, three accessible states and working casing actions passed.');
